#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>
#include <stdint.h>

extern void voiceMacShortcutPressed(uintptr_t callback);

static void onMainThread(dispatch_block_t block) {
    if ([NSThread isMainThread]) {
        block();
    } else {
        dispatch_sync(dispatch_get_main_queue(), block);
    }
}

bool voicePlaceMacPanel(int width, int height, bool startup) {
    __block bool placed = false;
    onMainThread(^{
        for (NSWindow *window in NSApp.windows) {
            if (![window isKindOfClass:NSClassFromString(@"WailsWindow")]) {
                continue;
            }
            NSScreen *screen = window.screen ?: NSScreen.mainScreen;
            if (screen == nil) {
                return;
            }

            if (startup) {
                // Let the WebKit content supply the panel and its shadow.
                window.opaque = NO;
                window.backgroundColor = NSColor.clearColor;
                window.hasShadow = NO;
            }
            NSRect visible = screen.visibleFrame;
            NSRect previous = window.frame;
            CGFloat right = startup ? NSMaxX(visible) - 24 : NSMaxX(previous);
            CGFloat bottom = startup ? NSMinY(visible) + 24 : NSMinY(previous);
            CGFloat x = MAX(NSMinX(visible), MIN(right, NSMaxX(visible)) - width);
            CGFloat y = MAX(NSMinY(visible), MIN(bottom, NSMaxY(visible) - height));
            [window setFrame:NSMakeRect(x, y, width, height) display:YES animate:NO];
            placed = true;
            return;
        }
    });
    return placed;
}

static const OSType hotkeySignature = 'VTyp';
static EventHandlerRef shortcutHandler;
static EventHotKeyRef registeredShortcut;
static UInt32 registeredKey, registeredModifiers, registeredID;
static uintptr_t shortcutCallback;
static bool keyHeld;

static OSStatus handleShortcut(EventHandlerCallRef next, EventRef event, void *data) {
    EventHotKeyID id;
    if (GetEventParameter(event, kEventParamDirectObject, typeEventHotKeyID,
                          NULL, sizeof(id), NULL, &id) != noErr ||
        id.signature != hotkeySignature || id.id != registeredID) {
        return eventNotHandledErr;
    }
    if (GetEventKind(event) == kEventHotKeyReleased) {
        keyHeld = false;
    } else if (!keyHeld) {
        keyHeld = true;
        voiceMacShortcutPressed(shortcutCallback);
    }
    return noErr;
}

OSStatus voiceRegisterMacShortcut(UInt32 key, UInt32 modifiers, uintptr_t callback) {
    __block OSStatus result = noErr;
    onMainThread(^{
        if (shortcutHandler == NULL) {
            const EventTypeSpec events[] = {{kEventClassKeyboard, kEventHotKeyPressed},
                                            {kEventClassKeyboard, kEventHotKeyReleased}};
            result = InstallApplicationEventHandler(handleShortcut, 2, events, NULL, &shortcutHandler);
            if (result != noErr) {
                return;
            }
        }
        if (registeredShortcut != NULL && key == registeredKey && modifiers == registeredModifiers) {
            return;
        }
        EventHotKeyID id = {hotkeySignature, registeredID == 1 ? 2 : 1};
        EventHotKeyRef replacement = NULL;
        result = RegisterEventHotKey(key, modifiers, id, GetApplicationEventTarget(), 0, &replacement);
        if (result != noErr) {
            return;
        }
        if (registeredShortcut != NULL) {
            UnregisterEventHotKey(registeredShortcut);
        }
        registeredShortcut = replacement;
        registeredKey = key;
        registeredModifiers = modifiers;
        registeredID = id.id;
        shortcutCallback = callback;
        keyHeld = false;
    });
    return result;
}

void voiceUnregisterMacShortcut(void) {
    onMainThread(^{
        if (registeredShortcut != NULL) {
            UnregisterEventHotKey(registeredShortcut);
            registeredShortcut = NULL;
        }
        if (shortcutHandler != NULL) {
            RemoveEventHandler(shortcutHandler);
            shortcutHandler = NULL;
        }
        registeredID = 0;
        shortcutCallback = 0;
        keyHeld = false;
    });
}

int voiceMacLetterKey(unsigned char character) {
    __block int code = -1;
    onMainThread(^{
        TISInputSourceRef source = TISCopyCurrentASCIICapableKeyboardLayoutInputSource();
        if (source == NULL) {
            return;
        }
        CFDataRef layoutData = TISGetInputSourceProperty(source, kTISPropertyUnicodeKeyLayoutData);
        if (layoutData != NULL) {
            const UCKeyboardLayout *layout = (const UCKeyboardLayout *)CFDataGetBytePtr(layoutData);
            for (UInt16 key = 0; key < 128; key++) {
                UInt32 state = 0;
                UniChar chars[4];
                UniCharCount length = 0;
                OSStatus result = UCKeyTranslate(layout, key, kUCKeyActionDown, 0, LMGetKbdType(),
                                                 kUCKeyTranslateNoDeadKeysMask, &state, 4, &length, chars);
                if (result == noErr && length == 1 &&
                    (chars[0] == character || (character >= 'A' && character <= 'Z' &&
                                               chars[0] == character + 'a' - 'A'))) {
                    code = key;
                    break;
                }
            }
        }
        CFRelease(source);
    });
    return code;
}

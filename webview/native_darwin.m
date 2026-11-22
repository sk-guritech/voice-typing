#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>
#import <AVFoundation/AVFoundation.h>
#import <ApplicationServices/ApplicationServices.h>
#import <WebKit/WebKit.h>
#import <objc/runtime.h>
#include <stdint.h>

extern void voiceMacShortcutPressed(uintptr_t callback);

@interface VoiceTypingMediaDelegate : NSObject <WKUIDelegate>
@property(nonatomic, assign) id<WKUIDelegate> original;
@end

@implementation VoiceTypingMediaDelegate

- (BOOL)respondsToSelector:(SEL)selector {
    return [super respondsToSelector:selector] || [self.original respondsToSelector:selector];
}

- (id)forwardingTargetForSelector:(SEL)selector {
    return [self.original respondsToSelector:selector] ? self.original : [super forwardingTargetForSelector:selector];
}

- (void)webView:(WKWebView *)webView
    requestMediaCapturePermissionForOrigin:(WKSecurityOrigin *)origin
    initiatedByFrame:(WKFrameInfo *)frame
    type:(WKMediaCaptureType)type
    decisionHandler:(void (^)(WKPermissionDecision))decisionHandler {
    if (!frame.isMainFrame || type != WKMediaCaptureTypeMicrophone ||
        ![origin.protocol isEqualToString:@"wails"] || ![origin.host isEqualToString:@"wails"] ||
        origin.port != 0) {
        decisionHandler(WKPermissionDecisionDeny);
        return;
    }
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    if (status != AVAuthorizationStatusNotDetermined) {
        decisionHandler(status == AVAuthorizationStatusAuthorized ? WKPermissionDecisionGrant : WKPermissionDecisionDeny);
        return;
    }
    [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {
        dispatch_async(dispatch_get_main_queue(), ^{
            decisionHandler(granted ? WKPermissionDecisionGrant : WKPermissionDecisionDeny);
        });
    }];
}

@end

static void installMediaDelegate(NSWindow *window) {
    static char delegateKey;
    for (NSView *view in window.contentView.subviews) {
        if ([view isKindOfClass:WKWebView.class]) {
            WKWebView *webView = (WKWebView *)view;
            VoiceTypingMediaDelegate *delegate = [[VoiceTypingMediaDelegate alloc] init];
            delegate.original = webView.UIDelegate;
            objc_setAssociatedObject(webView, &delegateKey, delegate, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
            webView.UIDelegate = delegate;
            [delegate release];
            return;
        }
    }
}

static void requestPastePermission(void) {
    if (!CGPreflightPostEventAccess() && !CGRequestPostEventAccess()) {
        NSURL *pane = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility"];
        [NSWorkspace.sharedWorkspace openURL:pane];
    }
}

enum { microphoneMissing = 1, accessibilityMissing = 2, permissionMask = microphoneMissing | accessibilityMissing };

int voiceMacMissingPermissions(void) {
    int microphone = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio] == AVAuthorizationStatusAuthorized
        ? 0 : microphoneMissing;
    int accessibility = CGPreflightPostEventAccess() ? 0 : accessibilityMissing;
    return microphone | accessibility;
}

static bool relaunchForPermissions(void) {
    static bool relaunching;
    if (relaunching) {
        return true;
    }
    NSTask *task = [[NSTask alloc] init];
    task.executableURL = [NSURL fileURLWithPath:@"/bin/sh"];
    NSString *waitAndOpen = @"for i in $(/usr/bin/seq 1 50); do "
                            "if ! kill -0 \"$1\" 2>/dev/null; then exec /usr/bin/open -n \"$2\"; fi; "
                            "/bin/sleep 0.1; done";
    task.arguments = @[@"-c", waitAndOpen,
        @"voice-typing-relaunch", [NSString stringWithFormat:@"%d", getpid()], NSBundle.mainBundle.bundlePath];
    relaunching = [task launchAndReturnError:NULL];
    [task release];
    if (relaunching) {
        NSLog(@"Voice Typing is restarting after permission setup.");
        [NSApp terminate:nil];
    }
    return relaunching;
}

@interface VoiceTypingPermissionActions : NSObject
@property(nonatomic, assign) NSButton *microphoneButton;
@property(nonatomic, assign) NSButton *accessibilityButton;
- (void)requestMicrophone:(id)sender;
- (void)requestAccessibility:(id)sender;
- (void)showMissingPermissions:(int)missing;
@end

@implementation VoiceTypingPermissionActions

- (void)requestMicrophone:(id)sender {
    AVAuthorizationStatus status = [AVCaptureDevice authorizationStatusForMediaType:AVMediaTypeAudio];
    if (status == AVAuthorizationStatusNotDetermined) {
        [AVCaptureDevice requestAccessForMediaType:AVMediaTypeAudio completionHandler:^(BOOL granted) {}];
    } else {
        NSURL *pane = [NSURL URLWithString:@"x-apple.systempreferences:com.apple.preference.security?Privacy_Microphone"];
        [NSWorkspace.sharedWorkspace openURL:pane];
    }
}

- (void)requestAccessibility:(id)sender {
    requestPastePermission();
}

- (void)showMissingPermissions:(int)missing {
    bool microphone = !(missing & microphoneMissing);
    bool accessibility = !(missing & accessibilityMissing);
    [self.microphoneButton setEnabled:!microphone];
    [self.accessibilityButton setEnabled:!accessibility];
    self.microphoneButton.title = microphone ? @"許可済み / Allowed" : @"設定 / Set up";
    self.accessibilityButton.title = accessibility ? @"許可済み / Allowed" : @"設定 / Set up";
    self.microphoneButton.accessibilityLabel = microphone
        ? @"マイクは許可済み / Microphone allowed" : @"マイクを設定 / Set up Microphone";
    self.accessibilityButton.accessibilityLabel = accessibility
        ? @"アクセシビリティは許可済み / Accessibility allowed" : @"アクセシビリティを設定 / Set up Accessibility";
}

@end

static const CGFloat permissionContentWidth = 312;
static const CGFloat permissionRowHeight = 38;

static NSView *permissionRow(NSString *label, NSButton *button) {
    const CGFloat buttonWidth = 140;
    NSView *row = [[[NSView alloc] initWithFrame:NSMakeRect(0, 0, permissionContentWidth, permissionRowHeight)] autorelease];
    NSTextField *name = [NSTextField wrappingLabelWithString:label];
    name.frame = NSMakeRect(0, 0, permissionContentWidth - buttonWidth - 12, permissionRowHeight);
    button.frame = NSMakeRect(permissionContentWidth - buttonWidth, (permissionRowHeight - 28) / 2, buttonWidth, 28);
    [row addSubview:name];
    [row addSubview:button];
    return row;
}

static void layoutPermissionControls(NSView *controls, NSView *micRow, NSView *pasteRow,
                                     NSTextField *help, int missing) {
    help.hidden = !(missing & accessibilityMissing);
    CGFloat y = 0;
    if (!help.hidden) {
        NSRect measure = NSMakeRect(0, 0, permissionContentWidth, CGFLOAT_MAX);
        CGFloat height = ceil([help.cell cellSizeForBounds:measure].height) + 2;
        help.frame = NSMakeRect(0, 0, permissionContentWidth, height);
        y = height + 10;
    }
    [pasteRow setFrameOrigin:NSMakePoint(0, y)];
    [micRow setFrameOrigin:NSMakePoint(0, y + permissionRowHeight + 8)];
    [controls setFrameSize:NSMakeSize(permissionContentWidth, y + permissionRowHeight * 2 + 8)];
}

static void showPermissionSetup(void) {
    __block int missing = voiceMacMissingPermissions();
    if (missing == 0) {
        return;
    }

    VoiceTypingPermissionActions *actions = [[VoiceTypingPermissionActions alloc] init];
    NSButton *microphone = [NSButton buttonWithTitle:@"" target:actions action:@selector(requestMicrophone:)];
    NSButton *accessibility = [NSButton buttonWithTitle:@"" target:actions action:@selector(requestAccessibility:)];
    actions.microphoneButton = microphone;
    actions.accessibilityButton = accessibility;
    [actions showMissingPermissions:missing];

    NSView *micRow = permissionRow(@"マイク\nMicrophone", microphone);
    NSView *pasteRow = permissionRow(@"アクセシビリティ\nAccessibility", accessibility);
    NSTextField *updateHelp = [NSTextField wrappingLabelWithString:
        @"オンなのに未許可の場合は、旧署名の登録を削除し、今の Voice Typing.app を追加してください。"
         "\nIf already on, remove the entry for the old signature and add the current Voice Typing.app."];
    updateHelp.font = [NSFont systemFontOfSize:NSFont.smallSystemFontSize];
    updateHelp.textColor = NSColor.secondaryLabelColor;
    NSView *controls = [[[NSView alloc] initWithFrame:NSZeroRect] autorelease];
    [controls addSubview:micRow];
    [controls addSubview:pasteRow];
    [controls addSubview:updateHelp];
    layoutPermissionControls(controls, micRow, pasteRow, updateHelp, missing);

    NSAlert *alert = [[NSAlert alloc] init];
    alert.messageText = @"権限設定 / Permissions";
    alert.informativeText = @"両方を許可すると自動で再起動します。"
                             "\nAllow both permissions to restart automatically.";
    alert.accessoryView = controls;
    [alert addButtonWithTitle:@"再起動 / Restart"];
    [alert addButtonWithTitle:@"あとで / Later"];
    __block NSTask *probe = nil;
    NSTimer *timer = [NSTimer timerWithTimeInterval:1.5 repeats:YES block:^(NSTimer *check) {
        if (probe.running) {
            return;
        }
        if (probe != nil) {
            if (probe.terminationReason == NSTaskTerminationReasonExit && probe.terminationStatus <= permissionMask &&
                probe.terminationStatus != missing) {
                missing = probe.terminationStatus;
                [actions showMissingPermissions:missing];
                layoutPermissionControls(controls, micRow, pasteRow, updateHelp, missing);
                [alert layout];
            }
            [probe release];
            probe = nil;
        }
        if (missing != 0) {
            // macOS can cache permission checks in a running process.
            probe = [[NSTask alloc] init];
            probe.executableURL = NSBundle.mainBundle.executableURL;
            probe.arguments = @[@"--check-mac-permissions"];
            if (![probe launchAndReturnError:NULL]) {
                [probe release];
                probe = nil;
            }
            return;
        }
        [check invalidate];
        alert.informativeText = @"マイクとアクセシビリティの許可を確認しました。再起動しています…"
                                 "\nMicrophone and Accessibility are allowed. Restarting Voice Typing…";
        for (NSButton *button in alert.buttons) {
            button.enabled = NO;
        }
        [alert layout];
        [alert.window orderFrontRegardless];
        NSTimer *restart = [NSTimer timerWithTimeInterval:1.0 repeats:NO block:^(NSTimer *pending) {
            if (NSApp.modalWindow == alert.window) {
                [NSApp stopModalWithCode:NSAlertFirstButtonReturn];
            }
        }];
        [NSRunLoop.mainRunLoop addTimer:restart forMode:NSModalPanelRunLoopMode];
    }];
    [NSRunLoop.mainRunLoop addTimer:timer forMode:NSRunLoopCommonModes];
    [NSRunLoop.mainRunLoop addTimer:timer forMode:NSModalPanelRunLoopMode];
    NSModalResponse response = [alert runModal];
    [alert.window orderOut:nil];
    [timer invalidate];
    if (probe.running) {
        [probe terminate];
    }
    [probe release];
    [alert release];
    [actions release];
    if (response == NSAlertFirstButtonReturn) {
        // Quit the main Wails event loop after the permission dialog has unwound.
        dispatch_async(dispatch_get_main_queue(), ^{
            if (relaunchForPermissions()) {
                return;
            }
            NSAlert *failure = [[NSAlert alloc] init];
            failure.messageText = @"再起動できませんでした / Could not restart";
            failure.informativeText = @"Voice Typing を終了して開き直してください。"
                                       "\nQuit and reopen Voice Typing to apply the permissions.";
            [failure runModal];
            [failure release];
        });
    }
}

static void onMainThread(dispatch_block_t block) {
    if ([NSThread isMainThread]) {
        block();
    } else {
        dispatch_sync(dispatch_get_main_queue(), block);
    }
}

@interface VoiceTypingMouseRegion : NSObject {
    NSWindow *_window;
    NSSize _size;
    id _globalMonitor;
    id _localMonitor;
}
- (instancetype)initWithWindow:(NSWindow *)window;
- (void)setWidth:(int)width height:(int)height;
- (void)updateAtPoint:(NSPoint)point;
@end

@implementation VoiceTypingMouseRegion

- (instancetype)initWithWindow:(NSWindow *)window {
    self = [super init];
    if (self == nil) {
        return nil;
    }
    _window = window;
    // Mouse movement only. Leave input events untouched and update hit testing on boundary crossings.
    NSEventMask events = NSEventMaskMouseMoved | NSEventMaskLeftMouseUp;
    __block VoiceTypingMouseRegion *region = self;
    _globalMonitor = [NSEvent addGlobalMonitorForEventsMatchingMask:events handler:^(NSEvent *event) {
        [region updateAtPoint:NSEvent.mouseLocation];
    }];
    _localMonitor = [NSEvent addLocalMonitorForEventsMatchingMask:events handler:^NSEvent *(NSEvent *event) {
        [region updateAtPoint:NSEvent.mouseLocation];
        return event;
    }];
    if (_globalMonitor == nil || _localMonitor == nil) {
        [self release];
        return nil;
    }
    window.acceptsMouseMovedEvents = YES;
    [NSNotificationCenter.defaultCenter addObserver:self selector:@selector(windowWillClose:)
        name:NSWindowWillCloseNotification object:window];
    return self;
}

- (void)stopMonitoring {
    if (_globalMonitor != nil) {
        [NSEvent removeMonitor:_globalMonitor];
        _globalMonitor = nil;
    }
    if (_localMonitor != nil) {
        [NSEvent removeMonitor:_localMonitor];
        _localMonitor = nil;
    }
}

- (void)windowWillClose:(NSNotification *)notification {
    [self stopMonitoring];
}

- (void)dealloc {
    [self stopMonitoring];
    [NSNotificationCenter.defaultCenter removeObserver:self];
    [super dealloc];
}

- (void)setWidth:(int)width height:(int)height {
    _size = NSMakeSize(width, height);
    [self updateAtPoint:NSEvent.mouseLocation];
}

- (void)updateAtPoint:(NSPoint)point {
    NSRect frame = _window.frame;
    NSRect active = NSMakeRect(NSMaxX(frame) - _size.width, NSMinY(frame), _size.width, _size.height);
    BOOL ignore = !NSPointInRect(point, active);
    if (_window.ignoresMouseEvents != ignore) {
        _window.ignoresMouseEvents = ignore;
    }
}

@end

bool voicePlaceMacPanel(int width, int height, int windowWidth, int windowHeight,
                        bool startup, bool setupPermissions) {
    __block bool placed = false;
    onMainThread(^{
        static char mouseRegionKey;
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
                installMediaDelegate(window);
                if (setupPermissions) {
                    dispatch_async(dispatch_get_main_queue(), ^{ showPermissionSetup(); });
                }
                VoiceTypingMouseRegion *region = [[VoiceTypingMouseRegion alloc] initWithWindow:window];
                if (region == nil) {
                    return;
                }
                objc_setAssociatedObject(window, &mouseRegionKey, region, OBJC_ASSOCIATION_RETAIN_NONATOMIC);
                [region release];
                NSRect visible = screen.visibleFrame;
                CGFloat x = MAX(NSMinX(visible), NSMaxX(visible) - windowWidth - 24);
                CGFloat y = MAX(NSMinY(visible), NSMinY(visible) + 24);
                [window setFrame:NSMakeRect(x, y, windowWidth, windowHeight) display:YES animate:NO];
            }
            VoiceTypingMouseRegion *region = objc_getAssociatedObject(window, &mouseRegionKey);
            if (region != nil) {
                [region setWidth:width height:height];
                placed = true;
            }
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

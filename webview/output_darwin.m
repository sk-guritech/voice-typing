#import <ApplicationServices/ApplicationServices.h>
#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>

void voiceMacPromptForInputAccess(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        AXIsProcessTrustedWithOptions((__bridge CFDictionaryRef)@{
            (__bridge NSString *)kAXTrustedCheckOptionPrompt: @YES
        });
    });
}

static AXUIElementRef copyFocusedElement(void) {
    AXUIElementRef system = AXUIElementCreateSystemWide();
    AXUIElementSetMessagingTimeout(system, 0.15);
    CFTypeRef focused = NULL;
    AXError result = AXUIElementCopyAttributeValue(system, kAXFocusedUIElementAttribute, &focused);
    CFRelease(system);
    if (result != kAXErrorSuccess || focused == NULL) {
        return NULL;
    }
    if (CFGetTypeID(focused) != AXUIElementGetTypeID()) {
        CFRelease(focused);
        return NULL;
    }
    AXUIElementSetMessagingTimeout((AXUIElementRef)focused, 0.15);
    return (AXUIElementRef)focused;
}

static bool matchesAttribute(AXUIElementRef element, CFStringRef attribute, CFStringRef expected) {
    CFTypeRef value = NULL;
    if (AXUIElementCopyAttributeValue(element, attribute, &value) != kAXErrorSuccess || value == NULL) {
        return false;
    }
    bool matches = CFEqual(value, expected);
    CFRelease(value);
    return matches;
}

static bool selectionIsWritable(AXUIElementRef element) {
    Boolean writable = false;
    return AXUIElementIsAttributeSettable(element, kAXSelectedTextAttribute, &writable) == kAXErrorSuccess &&
           writable;
}

AXUIElementRef voiceMacFocusedInput(void) {
    AXUIElementRef element = copyFocusedElement();
    if (element == NULL) {
        return NULL;
    }
    pid_t pid = 0;
    bool external = AXUIElementGetPid(element, &pid) == kAXErrorSuccess && pid != getpid();
    if (external && !matchesAttribute(element, kAXSubroleAttribute, kAXSecureTextFieldSubrole) &&
        (matchesAttribute(element, kAXRoleAttribute, kAXTextFieldRole) ||
         matchesAttribute(element, kAXRoleAttribute, kAXTextAreaRole) ||
         selectionIsWritable(element))) {
        return element;
    }
    CFRelease(element);
    return NULL;
}

bool voiceMacInputFocused(AXUIElementRef element) {
    AXUIElementRef current = copyFocusedElement();
    if (current == NULL) {
        return false;
    }
    bool matches = CFEqual(current, element);
    CFRelease(current);
    return matches;
}

bool voiceMacPasteKeysHeld(void) {
    const CGEventSourceStateID state = kCGEventSourceStateCombinedSessionState;
    const CGEventFlags flags = kCGEventFlagMaskCommand | kCGEventFlagMaskShift |
                              kCGEventFlagMaskAlternate | kCGEventFlagMaskControl |
                              kCGEventFlagMaskSecondaryFn;
    return (CGEventSourceFlagsState(state) & flags) != 0 ||
           CGEventSourceKeyState(state, kVK_PageDown);
}

static bool isTerminal(pid_t pid) {
    @autoreleasepool {
        NSString *bundle = [NSRunningApplication runningApplicationWithProcessIdentifier:pid].bundleIdentifier;
        return [@[@"com.apple.Terminal", @"com.googlecode.iterm2", @"dev.warp.Warp-Stable",
                  @"com.mitchellh.ghostty", @"net.kovidgoyal.kitty", @"org.alacritty",
                  @"com.github.wez.wezterm"] containsObject:bundle ?: @""];
    }
}

bool voiceMacPaste(AXUIElementRef element, int key, const char *bytes, size_t length, bool hasControl) {
    pid_t pid = 0;
    if (voiceMacPasteKeysHeld() || !voiceMacInputFocused(element) ||
        AXUIElementGetPid(element, &pid) != kAXErrorSuccess || (hasControl && isTerminal(pid))) {
        return false;
    }
    if (selectionIsWritable(element)) {
        CFStringRef text = CFStringCreateWithBytes(NULL, (const UInt8 *)bytes, length, kCFStringEncodingUTF8, false);
        if (text != NULL) {
            AXError result = AXUIElementSetAttributeValue(element, kAXSelectedTextAttribute, text);
            CFRelease(text);
            if (result == kAXErrorSuccess) {
                return true;
            }
        }
    }
    if (key < 0 || !CGPreflightPostEventAccess() || !voiceMacInputFocused(element)) {
        return false;
    }
    CGEventRef down = CGEventCreateKeyboardEvent(NULL, (CGKeyCode)key, true);
    CGEventRef up = CGEventCreateKeyboardEvent(NULL, (CGKeyCode)key, false);
    bool posted = down != NULL && up != NULL;
    if (posted) {
        CGEventSetFlags(down, kCGEventFlagMaskCommand);
        CGEventSetFlags(up, kCGEventFlagMaskCommand);
        CGEventPostToPid(pid, down);
        CGEventPostToPid(pid, up);
    }
    if (down != NULL) {
        CFRelease(down);
    }
    if (up != NULL) {
        CFRelease(up);
    }
    return posted;
}

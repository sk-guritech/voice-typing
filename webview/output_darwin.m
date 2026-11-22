#import <ApplicationServices/ApplicationServices.h>
#import <Cocoa/Cocoa.h>
#import <Carbon/Carbon.h>

void voiceMacPromptForInputAccess(void) {
    dispatch_async(dispatch_get_main_queue(), ^{
        CGRequestPostEventAccess();
    });
}

bool voiceMacPasteKeysHeld(void) {
    const CGEventSourceStateID state = kCGEventSourceStateCombinedSessionState;
    const CGEventFlags flags = kCGEventFlagMaskCommand | kCGEventFlagMaskShift |
                              kCGEventFlagMaskAlternate | kCGEventFlagMaskControl;
    return (CGEventSourceFlagsState(state) & flags) != 0 ||
           CGEventSourceKeyState(state, kVK_PageDown);
}

static bool isTerminal(NSString *bundle) {
    return [@[@"com.apple.Terminal", @"com.googlecode.iterm2", @"dev.warp.Warp-Stable",
              @"com.mitchellh.ghostty", @"net.kovidgoyal.kitty", @"org.alacritty",
              @"com.github.wez.wezterm"] containsObject:bundle ?: @""];
}

bool voiceMacPaste(int key, bool hasControl) {
    if (key < 0 || voiceMacPasteKeysHeld()) {
        return false;
    }
    @autoreleasepool {
        // Resolve the recipient when the transcript is ready, after copying it.
        NSRunningApplication *front = NSWorkspace.sharedWorkspace.frontmostApplication;
        pid_t pid = front.processIdentifier;
        if (pid <= 0 || pid == getpid() || (hasControl && isTerminal(front.bundleIdentifier))) {
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
}

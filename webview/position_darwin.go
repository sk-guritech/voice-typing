package main

/*
#cgo LDFLAGS: -framework AVFoundation -framework WebKit
#include <stdbool.h>
bool voicePlaceMacPanel(int width, int height, int windowWidth, int windowHeight,
                        bool startup, bool setupPermissions, bool english);
*/
import "C"

const windowClassName = ""
const fixedPanelBounds = true

func (p *Probe) PlacePanel(width, height int, startup bool) bool {
	p.settingsMu.Lock()
	english := p.prefs.Language == "en"
	p.settingsMu.Unlock()
	return bool(C.voicePlaceMacPanel(C.int(width), C.int(height), C.int(settingsWidth), C.int(settingsHeight),
		C.bool(startup), C.bool(!p.IsSelfTest()), C.bool(english)))
}

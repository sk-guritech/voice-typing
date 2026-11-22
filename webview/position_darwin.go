package main

/*
#include <stdbool.h>
bool voicePlaceMacPanel(int width, int height, bool startup);
*/
import "C"

const windowClassName = ""
const fixedPanelBounds = false

func (p *Probe) PlacePanel(width, height int, startup bool) bool {
	return bool(C.voicePlaceMacPanel(C.int(width), C.int(height), C.bool(startup)))
}

//go:build !windows

package main

const windowClassName = ""
const fixedPanelBounds = false

func (p *Probe) PlacePanel(width, height int, startup bool) bool { return false }

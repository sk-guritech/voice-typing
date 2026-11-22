//go:build !windows && !darwin

package main

const windowClassName = ""
const fixedPanelBounds = false

func missingMacPermissions() int { return 3 }

func (p *Probe) PlacePanel(width, height int, startup bool) bool { return false }

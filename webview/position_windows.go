package main

import (
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
	panelUser32       = windows.NewLazySystemDLL("user32.dll")
	enumPanelWindows  = panelUser32.NewProc("EnumWindows")
	panelWindowPID    = panelUser32.NewProc("GetWindowThreadProcessId")
	panelWindowClass  = panelUser32.NewProc("GetClassNameW")
	panelGetRect      = panelUser32.NewProc("GetWindowRect")
	panelSetPos       = panelUser32.NewProc("SetWindowPos")
	panelSystemInfo   = panelUser32.NewProc("SystemParametersInfoW")
	panelGetDPI       = panelUser32.NewProc("GetDpiForWindow")
	panelMonitorAt    = panelUser32.NewProc("MonitorFromRect")
	panelMonitorInfo  = panelUser32.NewProc("GetMonitorInfoW")
	panelSetRegion    = panelUser32.NewProc("SetWindowRgn")
	panelGDI          = windows.NewLazySystemDLL("gdi32.dll")
	panelCreateRegion = panelGDI.NewProc("CreateRectRgn")
	panelDeleteRegion = panelGDI.NewProc("DeleteObject")
	findPanelCallback = windows.NewCallback(findVoicePanel)
)

const windowClassName = "VoiceTypingWebViewPanel"
const fixedPanelBounds = true

func missingMacPermissions() int { return 3 }

type panelRect struct {
	left, top, right, bottom int32
}

type monitorInfo struct {
	size          uint32
	monitor, work panelRect
	flags         uint32
}

func movePanel(hwnd uintptr, x, y int32) bool {
	const noSize, noZOrder, noActivate = 0x0001, 0x0004, 0x0010
	ok, _, _ := panelSetPos.Call(hwnd, 0, uintptr(x), uintptr(y), 0, 0, noSize|noZOrder|noActivate)
	return ok != 0
}

func fitExpandedPanel(hwnd uintptr, window panelRect, left, top, compactWidth, compactHeight int32) {
	anchor := panelRect{window.right - compactWidth, window.bottom - compactHeight, window.right, window.bottom}
	const nearestMonitor = 2
	monitor, _, _ := panelMonitorAt.Call(uintptr(unsafe.Pointer(&anchor)), nearestMonitor)
	info := monitorInfo{size: uint32(unsafe.Sizeof(monitorInfo{}))}
	if ok, _, _ := panelMonitorInfo.Call(monitor, uintptr(unsafe.Pointer(&info))); ok == 0 {
		return
	}
	x := max(info.work.left-left, min(window.left, info.work.right-(window.right-window.left)))
	y := max(info.work.top-top, min(window.top, info.work.bottom-(window.bottom-window.top)))
	if x != window.left || y != window.top {
		movePanel(hwnd, x, y)
	}
}

func findVoicePanel(hwnd, result uintptr) uintptr {
	var pid uint32
	panelWindowPID.Call(hwnd, uintptr(unsafe.Pointer(&pid)))
	if pid == windows.GetCurrentProcessId() {
		var className [64]uint16
		panelWindowClass.Call(hwnd, uintptr(unsafe.Pointer(&className[0])), uintptr(len(className)))
		if windows.UTF16ToString(className[:]) == windowClassName {
			*(*uintptr)(unsafe.Pointer(result)) = hwnd
			return 0
		}
	}
	return 1
}

func (p *Probe) PlacePanel(width, height int, startup bool) bool {
	var hwnd uintptr
	enumPanelWindows.Call(findPanelCallback, uintptr(unsafe.Pointer(&hwnd)))
	if hwnd == 0 {
		return false
	}

	var previous panelRect
	ok, _, _ := panelGetRect.Call(hwnd, uintptr(unsafe.Pointer(&previous)))
	if ok == 0 {
		return false
	}
	w, h := previous.right-previous.left, previous.bottom-previous.top
	if startup {
		const getWorkArea = 0x0030
		var work panelRect
		ok, _, _ = panelSystemInfo.Call(getWorkArea, 0, uintptr(unsafe.Pointer(&work)), 0)
		if ok == 0 {
			return false
		}
		x := max(work.left, work.right-24-w)
		y := max(work.top, work.bottom-24-h)
		if !movePanel(hwnd, x, y) {
			return false
		}
		if ok, _, _ = panelGetRect.Call(hwnd, uintptr(unsafe.Pointer(&previous))); ok == 0 {
			return false
		}
		w, h = previous.right-previous.left, previous.bottom-previous.top
	}

	// Keep the WebView2 surface at the settings size and clip the unused area so
	// opening settings does not recreate the surface under the toolbar.
	dpi := uintptr(96)
	if panelGetDPI.Find() == nil {
		if windowDPI, _, _ := panelGetDPI.Call(hwnd); windowDPI != 0 {
			dpi = windowDPI
		}
	}
	left := max(0, w-int32(width*int(dpi)/96))
	top := max(0, h-int32(height*int(dpi)/96))
	if !startup && height > 69 {
		fitExpandedPanel(hwnd, previous, left, top, int32(180*int(dpi)/96), int32(69*int(dpi)/96))
	}
	if width == settingsWidth && height == settingsHeight {
		ok, _, _ = panelSetRegion.Call(hwnd, 0, 1)
		return ok != 0
	}
	region, _, _ := panelCreateRegion.Call(uintptr(left), uintptr(top), uintptr(w), uintptr(h))
	if region == 0 {
		return false
	}
	ok, _, _ = panelSetRegion.Call(hwnd, region, 1)
	if ok == 0 {
		panelDeleteRegion.Call(region)
	}
	return ok != 0
}

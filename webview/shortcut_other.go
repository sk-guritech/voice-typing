//go:build !windows

package main

func startNativeShortcut(onPress func()) nativeShortcut { return nil }

//go:build !windows && !darwin && !linux

package main

func startNativeShortcut(onPress func()) nativeShortcut { return nil }

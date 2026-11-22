//go:build !windows && !darwin

package main

func startNativeShortcut(onPress func()) nativeShortcut { return nil }

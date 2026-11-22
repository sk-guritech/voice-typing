//go:build !windows && !darwin && !linux

package main

func foregroundInput() inputTarget { return nil }

func pasteTranscript(_ *trackedTarget, _ string) bool { return false }

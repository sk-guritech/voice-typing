//go:build !windows && !darwin

package main

func foregroundInput() inputTarget { return nil }

func pasteTranscript(_ *trackedTarget, _ string) bool { return false }

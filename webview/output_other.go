//go:build !windows && !darwin && !linux

package main

func pasteTranscript(string) bool { return false }

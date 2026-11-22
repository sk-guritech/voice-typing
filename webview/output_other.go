//go:build !windows && !darwin

package main

func foregroundInput() inputTarget { return nil }

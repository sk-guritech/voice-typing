package main

/*
#cgo pkg-config: gtk+-3.0
#cgo !webkit2_41 pkg-config: webkit2gtk-4.0
#cgo webkit2_41 pkg-config: webkit2gtk-4.1
#include <webkit2/webkit2.h>

static gboolean own_panel(WebKitWebView *view) {
    return g_strcmp0(webkit_web_view_get_uri(view), "wails://wails/") == 0;
}

static gboolean allow_panel_audio(WebKitWebView *view, WebKitPermissionRequest *request, gpointer data) {
    if (!own_panel(view) || !WEBKIT_IS_USER_MEDIA_PERMISSION_REQUEST(request)) {
        return FALSE;
    }
    WebKitUserMediaPermissionRequest *media = WEBKIT_USER_MEDIA_PERMISSION_REQUEST(request);
    if (!webkit_user_media_permission_is_for_audio_device(media) ||
        webkit_user_media_permission_is_for_video_device(media)) {
        return FALSE;
    }
    webkit_permission_request_allow(request);
    return TRUE;
}

static void connect_panel_audio(GtkWidget *widget, gpointer data) {
    if (WEBKIT_IS_WEB_VIEW(widget) && own_panel(WEBKIT_WEB_VIEW(widget))) {
        if (!g_signal_handler_find(widget, G_SIGNAL_MATCH_FUNC, 0, 0, NULL, G_CALLBACK(allow_panel_audio), NULL)) {
            g_signal_connect(widget, "permission-request", G_CALLBACK(allow_panel_audio), NULL);
        }
    } else if (GTK_IS_CONTAINER(widget)) {
        gtk_container_foreach(GTK_CONTAINER(widget), connect_panel_audio, NULL);
    }
}

static gboolean setup_panel_audio(gpointer data) {
    GList *windows = gtk_window_list_toplevels();
    for (GList *item = windows; item != NULL; item = item->next) {
        connect_panel_audio(GTK_WIDGET(item->data), NULL);
    }
    g_list_free(windows);
    return G_SOURCE_REMOVE;
}

static void setup_microphone(void) {
    // Wails delivers OnDomReady outside the GTK thread.
    g_idle_add(setup_panel_audio, NULL);
}
*/
import "C"

import "context"

func setupMicrophone(context.Context) {
	C.setup_microphone()
}

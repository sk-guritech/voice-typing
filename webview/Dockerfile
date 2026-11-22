FROM mcr.microsoft.com/devcontainers/base:ubuntu-22.04

COPY install-linux-probe-deps.sh /tmp/install-linux-probe-deps.sh
RUN bash /tmp/install-linux-probe-deps.sh && useradd --create-home wailsprobe

RUN curl -fsSL https://go.dev/dl/go1.27.4.linux-amd64.tar.gz -o /tmp/voice-go.tar.gz \
  && echo '7226736c2339719cda28fbf3a54d71aa63bcefe376e98cef00034268dab24840  /tmp/voice-go.tar.gz' | sha256sum -c - \
  && tar -xzf /tmp/voice-go.tar.gz -C /usr/local

WORKDIR /probe
COPY go.mod go.sum ./
RUN /usr/local/go/bin/go mod download
COPY main.go settings.go openai.go position_other.go shortcut.go shortcut_other.go output.go output_other.go microphone_linux.go ./
COPY ui ./ui
COPY assets/icon.png ./assets/icon.png
RUN /usr/local/go/bin/go build -tags production,webkit2_41 -trimpath -ldflags '-s -w' -o /usr/local/bin/voice-typing .

USER wailsprobe
WORKDIR /tmp

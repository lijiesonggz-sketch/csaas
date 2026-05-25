append_path_if_dir() {
  path_to_append="$1"
  if [ -n "$path_to_append" ] && [ -d "$path_to_append" ]; then
    PATH="$path_to_append:$PATH"
  fi
}

append_windows_path_if_dir() {
  windows_path="$1"
  if [ -z "$windows_path" ]; then
    return
  fi

  if command -v cygpath >/dev/null 2>&1; then
    posix_path="$(cygpath -u "$windows_path" 2>/dev/null || true)"
    append_path_if_dir "$posix_path"
    if [ -n "$posix_path" ] && [ -d "$posix_path" ]; then
      windows_process_path="$(cygpath -w "$posix_path" 2>/dev/null || true)"
      if [ -n "$windows_process_path" ]; then
        Path="$windows_process_path${Path:+;$Path}"
        export Path
      fi
    fi
  else
    append_path_if_dir "$windows_path"
  fi
}

append_path_if_dir "/usr/bin"
append_path_if_dir "/bin"
append_path_if_dir "/cmd"
append_path_if_dir "/mingw64/bin"
append_windows_path_if_dir "C:\\Program Files\\Git\\cmd"
append_windows_path_if_dir "C:\\Windows\\System32"

if [ -n "${APPDATA:-}" ]; then
  append_windows_path_if_dir "$APPDATA\\npm"
fi
if [ -n "${LOCALAPPDATA:-}" ]; then
  append_windows_path_if_dir "$LOCALAPPDATA\\Programs\\nodejs"
fi
if [ -n "${ProgramW6432:-}" ]; then
  append_windows_path_if_dir "$ProgramW6432\\nodejs"
fi
if [ -n "${ProgramFiles:-}" ]; then
  append_windows_path_if_dir "$ProgramFiles\\nodejs"
fi
append_windows_path_if_dir "C:\\Program Files\\nodejs"
append_windows_path_if_dir "D:\\Program Files\\nodejs"
export PATH

for required_command in node npm; do
  if ! command -v "$required_command" >/dev/null 2>&1; then
    echo "[husky] Required command '$required_command' was not found. Install Node.js or add it to PATH." >&2
    exit 127
  fi
done

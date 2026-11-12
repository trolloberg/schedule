# Liest "xcrun simctl list devices available -j" und gibt die Kennung des gewünschten Geräts
# auf der neuesten iOS-Version aus.
import json, re, sys
name = sys.argv[1]
devices = json.load(sys.stdin)["devices"]
def version(runtime):
    m = re.search(r"iOS-(\d+)-(\d+)", runtime)
    return (int(m.group(1)), int(m.group(2))) if m else (0, 0)
for runtime in sorted((r for r in devices if "iOS" in r), key=version, reverse=True):
    for d in devices[runtime]:
        if d.get("name") == name and d.get("isAvailable", True):
            print(d["udid"])
            sys.exit(0)
sys.exit("Kein Simulator namens %s gefunden" % name)

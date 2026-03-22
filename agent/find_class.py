import livekit.agents
import inspect
import sys

out = []
def scan(module_obj, prefix=""):
    for name, obj in inspect.getmembers(module_obj):
        if inspect.isclass(obj):
            if "Voice" in name or "Pipeline" in name:
                out.append(f"{prefix}{name}")
        elif inspect.ismodule(obj) and obj.__name__.startswith("livekit.agents"):
            if "utils" not in name:
                # Basic recursion
                pass

for k, v in sys.modules.items():
    if k.startswith("livekit.agents"):
        for cn, cls in inspect.getmembers(v, inspect.isclass):
            if "Voice" in cn or "Pipeline" in cn:
                out.append(f"{k}.{cn}")
                
print("FOUND_CLASSES:", set(out))

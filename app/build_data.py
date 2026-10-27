# SPDX-License-Identifier: MIT
# Copyright (c) 2026 Kinar

# python build_data.py [путь к репе], по умолчанию ../../Arcane

import json
import re
import sys
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

HERE = Path(__file__).resolve().parent
REPO = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else (HERE.parent.parent / "Arcane")
PROTOS = REPO / "Resources" / "Prototypes"
LOCALE = REPO / "Resources" / "Locale"

Loader = getattr(yaml, "CSafeLoader", yaml.SafeLoader)


class TagLoader(Loader):
    pass


def _any_tag(loader, suffix, node):
    if isinstance(node, yaml.MappingNode):
        data = loader.construct_mapping(node, deep=True)
        data["!type"] = suffix
        return data
    if isinstance(node, yaml.SequenceNode):
        return loader.construct_sequence(node, deep=True)
    return loader.construct_scalar(node)


TagLoader.add_multi_constructor("!type:", _any_tag)
TagLoader.add_multi_constructor("!", lambda l, s, n: _any_tag(l, s, n))


def load_ftl(lang):
    out = {}
    root = LOCALE / lang
    if not root.exists():
        return out
    for f in root.rglob("*.ftl"):
        key = None
        try:
            text = f.read_text(encoding="utf-8-sig", errors="replace")
        except OSError:
            continue
        for line in text.splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            if line[0] in " \t":
                s = line.strip()
                if key and not s.startswith(".") and not s.startswith("[") and not s.startswith("*["):
                    if not out[key]:
                        out[key] = s
                elif key and s.startswith(".desc") and "=" in s:
                    out[key + ".desc"] = s.split("=", 1)[1].strip()
                continue
            m = re.match(r"^([A-Za-z0-9_\-]+)\s*=\s*(.*)$", line)
            if m:
                key = m.group(1)
                out[key] = m.group(2).strip()
            else:
                key = None
    return out


FTL_RU = load_ftl("ru-RU")
FTL_EN = load_ftl("en-US")


def resolve_refs(text, ftl, depth=0):
    if not text or depth > 5:
        return text
    def sub(m):
        ref = m.group(1)
        return resolve_refs(ftl.get(ref) or FTL_EN.get(ref) or "", ftl, depth + 1)
    text = re.sub(r"\{\s*([A-Za-z0-9_\-]+)\s*\}", sub, text)
    text = re.sub(r"\{[^}]*\}", "", text)
    return text.strip()


def loc(key, ftl):
    if not key:
        return None
    v = ftl.get(key)
    return resolve_refs(v, ftl) if v else None


def iter_docs(want):
    pat = re.compile(r"type:\s*(" + "|".join(want) + r")\b")
    for f in PROTOS.rglob("*.yml"):
        try:
            text = f.read_text(encoding="utf-8-sig", errors="replace")
        except OSError:
            continue
        if not pat.search(text):
            continue
        try:
            docs = yaml.load(text, Loader=TagLoader)
        except yaml.YAMLError as e:
            print("skip", f.relative_to(PROTOS))
            continue
        if not isinstance(docs, list):
            continue
        for d in docs:
            if isinstance(d, dict) and d.get("type") in want:
                yield f, d


def deep_merge(base, over):
    if isinstance(base, dict) and isinstance(over, dict):
        r = dict(base)
        for k, v in over.items():
            r[k] = deep_merge(base.get(k), v) if k in base else v
        return r
    return over


def as_list(v):
    if v is None:
        return []
    return v if isinstance(v, list) else [v]


t0 = time.time()
print(REPO)

reagent_raw, reaction_raw, entity_raw = {}, {}, {}
reagent_file = {}
for f, d in iter_docs(["reagent", "reaction", "entity"]):
    pid = d.get("id")
    if not pid:
        continue
    t = d["type"]
    if t == "reagent":
        reagent_raw[pid] = d
        reagent_file[pid] = f.stem.lower()
    elif t == "reaction":
        reaction_raw[pid] = d
    else:
        entity_raw[pid] = d




_reagent_cache = {}


def reagent_full(pid, stack=()):
    if pid in _reagent_cache:
        return _reagent_cache[pid]
    d = reagent_raw.get(pid)
    if d is None or pid in stack:
        return {}
    merged = {}
    for p in as_list(d.get("parent")):
        merged = deep_merge(merged, reagent_full(p, stack + (pid,)))
    own = {k: v for k, v in d.items() if k not in ("abstract", "parent")}
    merged = deep_merge(merged, own)
    _reagent_cache[pid] = merged
    return merged



_ent_cache = {}


def entity_full(pid, stack=()):
    if pid in _ent_cache:
        return _ent_cache[pid]
    d = entity_raw.get(pid)
    if d is None or pid in stack:
        return {"components": {}}
    res = {"components": {}}
    for p in as_list(d.get("parent")):
        pr = entity_full(p, stack + (pid,))
        for k in ("name",):
            if pr.get(k):
                res[k] = pr[k]
        for ct, cd in pr["components"].items():
            res["components"][ct] = deep_merge(res["components"].get(ct, {}), cd)
    if d.get("name"):
        res["name"] = d["name"]
    for c in as_list(d.get("components")):
        if isinstance(c, dict) and "type" in c:
            ct = c["type"]
            cd = {k: v for k, v in c.items() if k != "type"}
            res["components"][ct] = deep_merge(res["components"].get(ct, {}), cd)
    _ent_cache[pid] = res
    return res


def entity_name(pid):
    ru = loc(f"ent-{pid}", FTL_RU)
    if ru:
        return ru
    d = entity_raw.get(pid)
    seen = set()
    while d and pid not in seen:
        seen.add(pid)
        if d.get("name"):
            return d["name"]
        ps = as_list(d.get("parent"))
        if not ps:
            break
        pid = ps[0]
        ru = loc(f"ent-{pid}", FTL_RU)
        if ru:
            return ru
        d = entity_raw.get(pid)
    return pid


DRINK_GROUPS = {"AlcoholicDrinks": "alcohol", "NonAlcoholicDrinks": "soft", "Drinks": "soft"}
CHEM_GROUPS = {
    "Medicine": "medicine", "Toxins": "toxins", "Narcotics": "narcotics",
    "Pyrotechnic": "pyro", "Elements": "elements", "Biological": "bio",
    "Botanical": "botany", "Special": "special",
}
FILE_FALLBACK = {
    "medicine": "medicine", "toxins": "toxins", "narcotics": "narcotics",
    "pyrotechnic": "pyro", "pyrotechnics": "pyro", "elements": "elements",
    "biological": "bio", "botany": "botany", "cleaning": "cleaning",
    "gases": "gases", "chemicals": "chemicals", "fun": "fun",
    "alcohol": "alcohol", "drinks": "soft", "juice": "soft", "soda": "soft",
    "food": "food", "condiments": "food", "ingredients": "food",
}


def classify(pid, full):
    g = full.get("group")
    if g in DRINK_GROUPS:
        return "drink", DRINK_GROUPS[g]
    if g in ("Foods",):
        return "food", "food"
    if g in CHEM_GROUPS:
        return "chem", CHEM_GROUPS[g]
    sub = FILE_FALLBACK.get(reagent_file.get(pid, ""), "other")
    if sub in ("alcohol", "soft"):
        return "drink", sub
    if sub == "food":
        return "food", "food"
    return "chem", sub


reagents = {}
for pid, d in reagent_raw.items():
    if d.get("abstract"):
        continue
    full = reagent_full(pid)
    name_key = full.get("name")
    ru = loc(name_key, FTL_RU)
    en = loc(name_key, FTL_EN)
    desc = loc(full.get("desc"), FTL_RU) or loc(full.get("desc"), FTL_EN)
    cat, sub = classify(pid, full)
    reagents[pid] = {
        "n": ru or en or pid,
        "en": en or pid,
        "d": desc or "",
        "c": str(full.get("color") or "#888888"),
        "cat": cat,
        "sub": sub,
    }


DISPENSERS = {
    "chem": ["EnergyChemDispenser", "ChemDispenser"],
    "booze": ["EnergyBoozeDispenser", "BoozeDispenser"],
    "soda": ["EnergySodaDispenser", "SodaDispenser"],
    "kitchen": ["ServiceEnergyChemDispenser"],
}


def container_reagents(eid):
    comps = entity_full(eid)["components"]
    out = []
    for sol in (comps.get("SolutionContainerManager", {}).get("solutions") or {}).values():
        for r in as_list((sol or {}).get("reagents")):
            if isinstance(r, dict) and r.get("ReagentId"):
                out.append(r["ReagentId"])
    return out


for src, ids in DISPENSERS.items():
    for eid in ids:
        if eid not in entity_raw:
            continue
        comps = entity_full(eid)["components"]
        found = set()
        energy = comps.get("EnergyReagentDispenser", {}).get("reagents") or {}
        found.update(energy.keys())
        fill = comps.get("EntityTableContainerFill", {}).get("containers") or {}
        for table in fill.values():
            for ch in as_list((table or {}).get("children")):
                if isinstance(ch, dict) and ch.get("id"):
                    found.update(container_reagents(ch["id"]))
        for rid in found:
            if rid in reagents:
                reagents[rid].setdefault("src", [])
                if src not in reagents[rid]["src"]:
                    reagents[rid]["src"].append(src)


extract = {}
for eid, d in entity_raw.items():
    if d.get("abstract"):
        continue
    comps = entity_full(eid)["components"]
    ex = comps.get("Extractable")
    if not ex or "BodyPart" in comps or "Organ" in comps:
        continue
    found = []
    for r in as_list((ex.get("juiceSolution") or {}).get("reagents")):
        if isinstance(r, dict) and r.get("ReagentId"):
            found.append(("juice", r["ReagentId"], r.get("Quantity", 0)))
    gname = ex.get("grindableSolutionName")
    if gname:
        sol = (comps.get("SolutionContainerManager", {}).get("solutions") or {}).get(gname) or {}
        for r in as_list(sol.get("reagents")):
            if isinstance(r, dict) and r.get("ReagentId"):
                found.append(("grind", r["ReagentId"], r.get("Quantity", 0)))
    if not found:
        continue
    name = entity_name(eid)
    for kind, rid, q in found:
        if rid not in reagents:
            continue
        lst = extract.setdefault(rid, {})
        key = (kind, name)
        try:
            q = float(q)
        except (TypeError, ValueError):
            q = 0
        if key not in lst or lst[key] < q:
            lst[key] = q

for rid, lst in extract.items():
    items = sorted(lst.items(), key=lambda kv: (kv[0][0] != "juice", -kv[1], kv[0][1]))
    reagents[rid]["ex"] = [[k[0], k[1], round(q, 2)] for k, q in items[:10]]


EFFECTS = {
    "Explosion": "explosion", "AreaReactionEffect": "area", "CreateGas": "gas",
    "Emp": "emp", "Flash": "flash", "SpawnEntity": "spawn",
    "AdjustSolutionThermalEnergy": "thermal", "PopupMessage": None,
}


def num(v, default=None):
    try:
        return float(v)
    except (TypeError, ValueError):
        return default


reactions = []
for rid, d in reaction_raw.items():
    if d.get("abstract"):
        continue
    reac = {}
    for name, rd in (d.get("reactants") or {}).items():
        rd = rd or {}
        e = {"a": num(rd.get("amount"), 1.0)}
        if rd.get("catalyst"):
            e["k"] = 1
        reac[name] = e
    prod = {k: num(v, 0) for k, v in (d.get("products") or {}).items()}
    if not reac:
        continue
    r = {"id": rid, "r": reac, "p": prod}
    mix = [m for m in as_list(d.get("requiredMixerCategories")) if m]
    if mix:
        r["mix"] = mix
    if d.get("minTemp") is not None:
        r["tmin"] = num(d.get("minTemp"))
    if d.get("maxTemp") is not None:
        r["tmax"] = num(d.get("maxTemp"))
    if d.get("quantized"):
        r["q"] = 1
    if d.get("source"):
        r["src"] = 1
    if d.get("priority"):
        r["pr"] = num(d.get("priority"), 0)
    effs, spawns = [], []
    for eff in as_list(d.get("effects")):
        if not isinstance(eff, dict):
            continue
        t = EFFECTS.get(eff.get("!type"), "other")
        if t is None:
            continue
        if t == "spawn" and eff.get("entity"):
            spawns.append(entity_name(eff["entity"]))
        elif t == "gas" and eff.get("gas"):
            effs.append("gas:" + str(eff["gas"]))
        elif t == "area":
            pe = eff.get("prototypeId") or ""
            effs.append("foam" if "Foam" in pe else "smoke")
        elif t not in effs:
            effs.append(t)
    if effs:
        r["fx"] = effs
    if spawns:
        r["spawn"] = sorted(set(spawns))
    reactions.append(r)

for r in reactions:
    for k in list(r["r"]) + list(r["p"]):
        if k not in reagents:
            reagents[k] = {"n": k, "en": k, "d": "", "c": "#888888", "cat": "chem", "sub": "other"}

mixers = {}
for m in ("Stir", "Shake", "Electrolysis", "Centrifuge", "Holy"):
    mixers[m] = loc(f"mixing-verb-{m.lower()}", FTL_RU) or m

data = {
    "generated": datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC"),
    "repo": REPO.name,
    "reagents": reagents,
    "reactions": sorted(reactions, key=lambda r: r["id"]),
    "mixers": mixers,
}

def body(d):
    return {k: v for k, v in d.items() if k not in ("generated", "repo")}


out = HERE / "data.js"
try:
    old = json.loads(out.read_text(encoding="utf-8").split("=", 1)[1].strip().rstrip(";"))
except (OSError, ValueError, IndexError):
    old = None

if old and body(old) == body(data):
    print("no changes")
else:
    out.write_text("window.CHEM_DATA = " + json.dumps(data, ensure_ascii=False, separators=(",", ":")) + ";\n",
                   encoding="utf-8")
    print(f"ok: {len(reagents)} reagents, {len(reactions)} reactions, {time.time() - t0:.1f}s")

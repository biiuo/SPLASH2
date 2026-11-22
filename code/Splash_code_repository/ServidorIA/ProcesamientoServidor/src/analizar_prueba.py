"""
Splash - análisis de una prueba en la piscina: qué mandó la IA, qué calculó el backend y qué marcó el cronómetro

Lee hasta tres fuentes y las cruza:
  * el registro de posiciones de la IA (--registro-csv del pipeline): saltos de posición, cambios de identidad,
    dos identidades a la vez en un carril (la "línea diagonal"), huecos sin datos;
  * el CSV de la sesión que baja la web: tiempos por largo (entre virajes), tramos "sospechosos" (más rápidos que
    una persona), descansos;
  * opcional: los parciales del cronómetro (segundos por largo), para comparar con los largos del backend.

Para cada tramo sospechoso muestra qué pasaba en el registro de la IA en ese momento, para saber si el problema es del
rastreo (la posición saltó o cambió la identidad) o del cálculo del backend (posiciones limpias, resultado malo).

Solo biblioteca estándar. Ejemplos:
    python analizar_prueba.py --posiciones posiciones.csv
    python analizar_prueba.py --posiciones posiciones.csv --sesion safesplash-sesion-20261119-1030-ab12cd34.csv
    python analizar_prueba.py --sesion sesion.csv --carril 2 --cronometro 31.2 29.8 30.5 30.1
"""
import argparse
import csv
import datetime as dt
import re
import statistics
from collections import defaultdict

VELOCIDAD_MAX_CREIBLE_MS = 2.5   # la misma que usa la web (velocidad-en-el-tiempo.ts)


def norm_carril(c):
    """'lane2', 'carril 2' o '2' -> '2'."""
    m = re.search(r"\d+", str(c))
    return m.group(0) if m else str(c).strip()


def iso_a_ms(s):
    if not s:
        return None
    return dt.datetime.fromisoformat(s.strip().replace("Z", "+00:00")).timestamp() * 1000


def hora(ms):
    """Hora de captura; con un video grabado el tiempo es del video ('T+12.3 s'), como en grabador.hora_de."""
    if ms is None:
        return "?"
    if ms < 1e12:
        return f"T+{ms / 1000:.1f} s"
    return dt.datetime.fromtimestamp(ms / 1000).strftime("%H:%M:%S.%f")[:-3]


def leer_csv(ruta):
    with open(ruta, encoding="utf-8-sig", newline="") as f:
        return list(csv.DictReader(f))


# ---------------------------------------------------------------- registro de la IA

def cargar_posiciones(ruta):
    """{carril: [fila ordenada por t]} con t (ms), identidad, x, y, estimada."""
    por_carril = defaultdict(list)
    for r in leer_csv(ruta):
        try:
            por_carril[norm_carril(r["carril"])].append({
                "t": float(r["t_ms"]), "identidad": r["identidad"], "x": float(r["px_x"]), "y": float(r["px_y"]),
                "estimada": r.get("estimada") == "1",
            })
        except (KeyError, ValueError):
            continue
    for filas in por_carril.values():
        filas.sort(key=lambda f: f["t"])
    return por_carril


def saltos(filas):
    """Por identidad, los pasos entre muestras seguidas: (t, px/s, distancia px). Solo muestras observadas."""
    ultimo = {}
    pasos = []
    for f in filas:
        if f["estimada"]:
            continue
        a = ultimo.get(f["identidad"])
        if a and f["t"] > a["t"]:
            d = ((f["x"] - a["x"]) ** 2 + (f["y"] - a["y"]) ** 2) ** 0.5
            pasos.append((f["t"], f["identidad"], d / ((f["t"] - a["t"]) / 1000), d))
        ultimo[f["identidad"]] = f
    return pasos


def solapes(filas, ventana_ms=1000):
    """Instantes en que dos identidades distintas mandan posiciones en el mismo carril a menos de `ventana_ms`."""
    ultimo = {}
    eventos = []
    for f in filas:
        for ident, t in ultimo.items():
            if ident != f["identidad"] and f["t"] - t < ventana_ms:
                eventos.append((f["t"], ident, f["identidad"]))
                break
        ultimo[f["identidad"]] = f["t"]
    return eventos


def informe_posiciones(por_carril, factor_salto):
    print("=" * 78)
    print("REGISTRO DE LA IA (lo que se mandó al backend, en píxeles)")
    print("=" * 78)
    resumen = {}
    for carril in sorted(por_carril, key=lambda c: (len(c), c)):
        filas = por_carril[carril]
        t0, t1 = filas[0]["t"], filas[-1]["t"]
        dur = max((t1 - t0) / 1000, 1e-9)
        idents = defaultdict(list)
        for f in filas:
            idents[f["identidad"]].append(f["t"])
        cambios = sum(1 for a, b in zip(filas, filas[1:]) if a["identidad"] != b["identidad"])
        huecos = [(a["t"], (b["t"] - a["t"]) / 1000) for a, b in zip(filas, filas[1:]) if b["t"] - a["t"] > 2000]
        est = sum(f["estimada"] for f in filas)
        pasos = saltos(filas)
        mediana = statistics.median(p[2] for p in pasos) if pasos else 0
        grandes = sorted((p for p in pasos if mediana and p[2] > factor_salto * mediana), key=lambda p: -p[2])
        sol = solapes(filas)

        print(f"\nCarril {carril}: {len(filas)} muestras en {dur:.0f} s ({len(filas) / dur:.1f}/s), "
              f"{hora(t0)} -> {hora(t1)}")
        print(f"  identidades: {len(idents)}  " + ", ".join(
            f"#{i} ({len(ts)} muestras, {hora(ts[0])}-{hora(ts[-1])})" for i, ts in idents.items()))
        print(f"  cambios de identidad entre muestras seguidas: {cambios}")
        print(f"  dos identidades a la vez (<1 s): {len(sol)}" + (
            "  <- posible 'línea diagonal'" if sol else ""))
        for t, a, b in sol[:5]:
            print(f"      {hora(t)}  #{a} y #{b}")
        print(f"  estimadas (nadador no visto, posición extrapolada): {est} ({100 * est / len(filas):.0f} %)")
        print(f"  huecos > 2 s sin datos: {len(huecos)}" + "".join(
            f"\n      {hora(t)}  {s:.1f} s" for t, s in huecos[:5]))
        print(f"  velocidad típica en la imagen: {mediana:.0f} px/s; saltos > {factor_salto:g}x eso: {len(grandes)}")
        for t, i, v, d in grandes[:5]:
            print(f"      {hora(t)}  #{i}  {v:.0f} px/s ({d:.0f} px)")
        resumen[carril] = {"saltos": grandes, "solapes": sol, "huecos": huecos, "filas": filas}
    return resumen


# ---------------------------------------------------------------- CSV de la sesión (backend)

def informe_sesion(ruta, largo_m, carril_crono, crono, resumen_ia):
    filas = leer_csv(ruta)
    por_carril = defaultdict(list)
    for r in filas:
        por_carril[norm_carril(r["carril"])].append(r)

    print("\n" + "=" * 78)
    print(f"SESIÓN (lo que calculó el backend)  {ruta}")
    print("=" * 78)
    for carril in sorted(por_carril, key=lambda c: (len(c), c)):
        rs = por_carril[carril]
        tramos = [r for r in rs if r["fila"] == "tramo"]
        virajes = [r for r in rs if r["tipo"] == "viraje"]
        descansos = [r for r in rs if r["tipo"] in ("inicio_descanso", "fin_descanso")]
        vel = [float(r["velocidad_ms"]) for r in tramos if r["velocidad_ms"]]
        sosp = [r for r in tramos if r["velocidad_ms"] and float(r["velocidad_ms"]) > VELOCIDAD_MAX_CREIBLE_MS]
        nombre = next((r["nadador"] for r in rs if r.get("nadador")), "")

        print(f"\nCarril {carril} {nombre}".rstrip() + ":")
        print(f"  identidades: {sorted({r['identidad'] for r in rs if r['identidad']})}")
        if vel:
            print(f"  tramos: {len(tramos)}  velocidad mediana {statistics.median(vel):.2f} m/s, "
                  f"máx {max(vel):.2f} m/s  (normal nadando: ~0.8-1.8 m/s)")
        print(f"  tramos sospechosos (> {VELOCIDAD_MAX_CREIBLE_MS} m/s): {len(sosp)}")
        for r in sosp[:8]:
            print(f"      t={r['t_inicio_s']} s  #{r['identidad']}  {r['nodo_desde_m']}->{r['nodo_hasta_m']} m  "
                  f"{float(r['velocidad_ms']):.2f} m/s en {r['duracion_s']} s  -> {diagnostico(r, carril, resumen_ia)}")

        largos = []
        for a, b in zip(virajes, virajes[1:]):
            if a["identidad"] == b["identidad"]:
                largos.append((float(b["t_inicio_s"]) - float(a["t_inicio_s"]), a["t_inicio_s"], b["identidad"]))
        print(f"  virajes: {len(virajes)}  ->  largos completos (viraje a viraje, misma identidad): {len(largos)}")
        for i, (s, t, ident) in enumerate(largos, 1):
            print(f"      largo {i}: {s:6.1f} s  ({largo_m / s:.2f} m/s)  desde t={t} s  #{ident}")
        for r in descansos:
            print(f"  {r['tipo']}: t={r['t_inicio_s']} s  #{r['identidad']}")

        if crono and carril_crono == carril:
            comparar(largos, crono)
    if crono and carril_crono not in por_carril:
        print(f"\n[AVISO] --carril {carril_crono} no aparece en la sesión: no se comparó el cronómetro.")


def diagnostico(tramo, carril, resumen_ia):
    """Qué pasaba en el registro de la IA durante el tramo (con un margen de 1 s)."""
    if not resumen_ia or carril not in resumen_ia:
        return "sin registro de la IA para cruzar"
    a, b = iso_a_ms(tramo["inicio"]), iso_a_ms(tramo["fin"])
    if a is None or b is None:
        return "?"
    a, b = a - 1000, b + 1000
    ia = resumen_ia[carril]
    motivos = []
    n = sum(1 for t, *_ in ia["saltos"] if a <= t <= b)
    if n:
        motivos.append(f"{n} salto(s) de posición")
    n = sum(1 for t, *_ in ia["solapes"] if a <= t <= b)
    if n:
        motivos.append("2 identidades a la vez")
    if any(t <= b and t + s * 1000 >= a for t, s in ia["huecos"]):
        motivos.append("hueco sin datos")
    en = [f for f in ia["filas"] if a <= f["t"] <= b]
    if en and sum(f["estimada"] for f in en) > len(en) / 2:
        motivos.append("posición mayormente estimada")
    if not en:
        return "la IA no mandó nada en ese momento (¿relojes distintos?)"
    return "RASTREO: " + ", ".join(motivos) if motivos else "posiciones limpias -> revisar BACKEND/calibración"


def comparar(largos, crono):
    print(f"\n  Cronómetro vs backend (en orden; el primer largo puede no coincidir si el backend no vio la salida):")
    print(f"      {'largo':>5} {'crono':>8} {'backend':>8} {'dif':>7}")
    difs = []
    for i in range(max(len(largos), len(crono))):
        c = crono[i] if i < len(crono) else None
        b = largos[i][0] if i < len(largos) else None
        d = b - c if c is not None and b is not None else None
        if d is not None:
            difs.append(d)
        cel = lambda v, fmt="8.1f": format(v, fmt) if v is not None else f"{'—':>8}"  # noqa: E731
        print(f"      {i + 1:>5} {cel(c)} {cel(b)} {cel(d, '+8.1f')}")
    if difs:
        print(f"      diferencia media {statistics.mean(difs):+.2f} s, máxima {max(difs, key=abs):+.2f} s")


def main():
    ap = argparse.ArgumentParser(description="Cruza el registro de la IA, el CSV de la sesión y el cronómetro.")
    ap.add_argument("--posiciones", help="CSV del pipeline (--registro-csv)")
    ap.add_argument("--sesion", help="CSV de la sesión bajado de la web")
    ap.add_argument("--largo-m", type=float, default=25.0, help="largo de la piscina (m)")
    ap.add_argument("--carril", help="carril cronometrado")
    ap.add_argument("--cronometro", type=float, nargs="+", help="segundos de cada largo según el cronómetro")
    ap.add_argument("--factor-salto", type=float, default=4.0,
                    help="un paso es 'salto' si es más de N veces la velocidad típica en la imagen")
    args = ap.parse_args()
    if not args.posiciones and not args.sesion:
        ap.error("pasá --posiciones, --sesion o los dos")
    if args.cronometro and not args.carril:
        ap.error("con --cronometro hay que decir --carril")

    resumen = informe_posiciones(cargar_posiciones(args.posiciones), args.factor_salto) if args.posiciones else {}
    if args.sesion:
        informe_sesion(args.sesion, args.largo_m, norm_carril(args.carril) if args.carril else None,
                       args.cronometro, resumen)


if __name__ == "__main__":
    main()

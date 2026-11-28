# Inventario de Coste de GPU por Pantalla, Modal y Editor

Viewport de referencia: `360×780 px` (`280,800 px²`). Medido en DOM renderizado sin modificar código de optimización.

## Resumen global

| Pantalla / Modal | `backdrop-filter` | `filter: blur` | `mask-image` | `box-shadow >2` | `will-change` | Anim. infinitas |
|---|---|---|---|---|---|---|
| Hoy (/) | 6 | 0 | 4 | 16 | 0 | 1 |
| Hábitos (/tasks) | 5 | 0 | 4 | 7 | 0 | 1 |
| Notas (/notes) | 6 | 1 | 4 | 4 | 0 | 1 |
| Balance (/balance) | 5 | 0 | 4 | 3 | 0 | 1 |
| Metas (/goals) | 5 | 1 | 4 | 1 | 0 | 1 |
| Calendario (/calendar) | 5 | 2 | 4 | 11 | 0 | 1 |
| Modal: Ajustes (settings-dialog.tsx) | 4 | 0 | 3 | 24 | 0 | 3 |
| Modal: Calculadora (calculator-modal.tsx) | 6 | 0 | 4 | 3 | 0 | 1 |

## Hoy (/)

**Capas con `backdrop-filter`:**
- `div.absolute.z-[100].left-4` — 35,112 px² (**12.5%** de pantalla) — `blur(12px)`
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
2. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
3. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
4. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
5. `div.absolute.z-[100].left-4` (35,112 px², 12.5%) — backdrop-filter(blur(12px)), box-shadow(5 capas)
6. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
7. `div.max-w-3xl.mx-auto.glass-panel` (50,764 px², 18.1%) — box-shadow(6 capas)
8. `div.glass-panel.p-3.md:p-4` (78,736 px², 28%) — box-shadow(6 capas)
9. `button.px-3.py-1.rounded-lg` (1,693 px², 0.6%) — box-shadow(6 capas)
10. `div.glass-panel.p-4.rounded-3xl` (17,920 px², 6.4%) — box-shadow(6 capas)

## Hábitos (/tasks)

**Capas con `backdrop-filter`:**
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
2. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
3. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
4. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
5. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
6. `button.w-full.md:w-auto.px-6` (13,440 px², 4.8%) — box-shadow(6 capas)
7. `button#btn-new-habit.w-full.md:w-auto.px-6` (13,440 px², 4.8%) — box-shadow(6 capas)
8. `button.px-3.py-1.5.bg-primary/10` (2,150 px², 0.8%) — box-shadow(6 capas)
9. `button.px-3.py-1.5.bg-white/5` (2,819 px², 1%) — box-shadow(6 capas)
10. `div.glass-panel.p-3.md:p-4` (74,480 px², 26.5%) — box-shadow(6 capas)

## Notas (/notes)

**Capas con `backdrop-filter`:**
- `div.fixed.inset-0.z-[100]` — 280,800 px² (**100%** de pantalla) — `blur(8px)`
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `div.fixed.inset-0.z-[100]` (280,800 px², 100%) — backdrop-filter(blur(8px))
2. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
3. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
4. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
5. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
6. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
7. `p.text-3xl.md:text-4xl.text-black` (20,160 px², 7.2%) — filter(blur(0.00239332px))
8. `div.bg-white.dark:bg-[#121212].rounded-[32px]` (60,670 px², 21.6%) — box-shadow(5 capas)
9. `div.w-[165px].flex-shrink-0.aspect-[4/5]` (4,771 px², 1.7%) — box-shadow(6 capas)
10. `div.glass-panel.p-6.rounded-2xl` (56,000 px², 19.9%) — box-shadow(6 capas)

## Balance (/balance)

**Capas con `backdrop-filter`:**
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
2. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
3. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
4. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
5. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
6. `button.px-6.py-3.bg-[#5c5c5c]` (4,869 px², 1.7%) — box-shadow(6 capas)
7. `button.px-6.py-3.bg-[#242424]` (3,953 px², 1.4%) — box-shadow(6 capas)

## Metas (/goals)

**Capas con `backdrop-filter`:**
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
2. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
3. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
4. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
5. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
6. `p.text-xl.md:text-2xl.text-black` (19,500 px², 6.9%) — filter(blur(0.00877147px))

## Calendario (/calendar)

**Capas con `backdrop-filter`:**
- `i.bl.bl1` — 21,504 px² (**7.7%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 21,504 px² (**7.7%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 21,504 px² (**7.7%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 21,504 px² (**7.7%** de pantalla) — `blur(18px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.bl.bl1` (21,504 px², 7.7%) — backdrop-filter(blur(2px)), mask-image
2. `i.bl.bl2` (21,504 px², 7.7%) — backdrop-filter(blur(5px)), mask-image
3. `i.bl.bl3` (21,504 px², 7.7%) — backdrop-filter(blur(10px)), mask-image
4. `i.bl.bl4` (21,504 px², 7.7%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
5. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
6. `p.text-2xl.md:text-3xl.text-black` (0 px², 0%) — filter(blur(0px))
7. `div.absolute.top-0.right-0` (16,384 px², 5.8%) — filter(blur(60px))
8. `div.flex.items-center.gap-4` (15,444 px², 5.5%) — box-shadow(6 capas)
9. `div.glass-panel.rounded-2xl.md:rounded-3xl` (152,100 px², 54.2%) — box-shadow(5 capas)
10. `div.min-h-[90px].md:min-h-[100px].p-1` (3,973 px², 1.4%) — box-shadow(5 capas)

## Modal: Ajustes (settings-dialog.tsx)

**Capas con `backdrop-filter`:**
- `i.g1` — 230,256 px² (**82%** de pantalla) — `blur(8px)`
- `i.g2` — 230,256 px² (**82%** de pantalla) — `blur(16px)`
- `i.g3` — 230,256 px² (**82%** de pantalla) — `blur(26px) saturate(1.5)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`

**Top 10 peores elementos:**
1. `i.g1` (230,256 px², 82%) — backdrop-filter(blur(8px)), mask-image
2. `i.g2` (230,256 px², 82%) — backdrop-filter(blur(16px)), mask-image
3. `i.g3` (230,256 px², 82%) — backdrop-filter(blur(26px) saturate(1.5)), mask-image
4. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
5. `div.max-w-3xl.mx-auto.glass-panel` (50,764 px², 18.1%) — box-shadow(6 capas)
6. `div.glass-panel.p-3.md:p-4` (78,736 px², 28%) — box-shadow(6 capas)
7. `button.px-3.py-1.rounded-lg` (1,693 px², 0.6%) — box-shadow(6 capas)
8. `div.glass-panel.p-4.rounded-3xl` (17,920 px², 6.4%) — box-shadow(6 capas)
9. `button.glass-panel.p-4.rounded-3xl` (17,920 px², 6.4%) — box-shadow(6 capas)
10. `div.w-12.h-12.rounded-full` (2,304 px², 0.8%) — box-shadow(6 capas)

## Modal: Calculadora (calculator-modal.tsx)

**Capas con `backdrop-filter`:**
- `div.fixed.inset-0.z-50` — 280,800 px² (**100%** de pantalla) — `blur(12px)`
- `button.fixed.z-[40].flex` — 2,180 px² (**0.8%** de pantalla) — `blur(12px)`
- `i.bl.bl1` — 0 px² (**0%** de pantalla) — `blur(2px)`
- `i.bl.bl2` — 0 px² (**0%** de pantalla) — `blur(5px)`
- `i.bl.bl3` — 0 px² (**0%** de pantalla) — `blur(10px)`
- `i.bl.bl4` — 0 px² (**0%** de pantalla) — `blur(18px) saturate(1.5)`

**Top 10 peores elementos:**
1. `div.fixed.inset-0.z-50` (280,800 px², 100%) — backdrop-filter(blur(12px))
2. `i.bl.bl1` (0 px², 0%) — backdrop-filter(blur(2px)), mask-image
3. `i.bl.bl2` (0 px², 0%) — backdrop-filter(blur(5px)), mask-image
4. `i.bl.bl3` (0 px², 0%) — backdrop-filter(blur(10px)), mask-image
5. `i.bl.bl4` (0 px², 0%) — backdrop-filter(blur(18px) saturate(1.5)), mask-image
6. `button.fixed.z-[40].flex` (2,180 px², 0.8%) — backdrop-filter(blur(12px)), box-shadow(6 capas)
7. `button.px-6.py-3.bg-[#5c5c5c]` (4,869 px², 1.7%) — box-shadow(6 capas)
8. `button.px-6.py-3.bg-[#242424]` (3,953 px², 1.4%) — box-shadow(6 capas)

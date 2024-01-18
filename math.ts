type XY = {
    x: number;
    y: number;
};

function sqr(x: number): number {
    return x * x;
}

function dist2(v: XY, w: XY) {
    return sqr(v.x - w.x) + sqr(v.y - w.y);
}

function euclideanDistance(a: XY, b: XY): number {
    return Math.sqrt(dist2(a, b));
}

function clamp(x: number, min: number, max: number): number {
    return Math.min(Math.max(x, min), max);
}

function distPointToLineSegment(point: XY, lineStart: XY, lineEnd: XY): number {
    var l2 = dist2(lineStart, lineEnd);
    if (l2 == 0) return dist2(point, lineStart);
    var t =
        ((point.x - lineStart.x) * (lineEnd.x - lineStart.x) + (point.y - lineStart.y) * (lineEnd.y - lineStart.y)) /
        l2;
    t = Math.max(0, Math.min(1, t));
    return dist2(point, {
        x: lineStart.x + t * (lineEnd.x - lineStart.x),
        y: lineStart.y + t * (lineEnd.y - lineStart.y)
    });
}

function floatingChips(chipMap: Map<ChipID, Chip>): ChipID[] {
    let notEncountered = new Set(chipMap.keys());

    let stack: ChipID[] = [];
    for (let chip of chipMap.values()) {
        if (chip.type === OUTPUT.type) {
            stack.push(chip.id);
        }
    }

    while (stack.length > 0) {
        let current = stack.pop()!;
        let chip = chipMap.get(current)!;

        notEncountered.delete(current);

        for (let i = 0; i < chip.inputPins.length; i++) {
            if (chip.inputPins[i] !== null) {
                let input = chip.inputPins[i]!;
                stack.push(input.chipID);
            }
        }
    }

    return Array.from(notEncountered);
}

function isPureFunction(chipMap: Map<ChipID, Chip>): boolean {
    let states = new Map<ChipID, number>();
    for (let chipID of chipMap.keys()) {
        states.set(chipID, 0);
    }

    let roots: ChipID[] = [];
    for (let chip of chipMap.values()) {
        if (chip.type === OUTPUT.type) {
            roots.push(chip.id);
        }
    }

    for (let root of roots) {
        if (cyclic(root, chipMap, states)) {
            return false;
        }
    }

    return true;
}

function cyclic(rootChipID: ChipID, chipMap: Map<ChipID, Chip>, states: Map<ChipID, number>): boolean {
    states.set(rootChipID, 1);

    let chip = chipMap.get(rootChipID)!;

    for (let i = 0; i < chip.inputPins.length; i++) {
        if (chip.inputPins[i] !== null) {
            let inputChipID = chip.inputPins[i]!.chipID;
            if (states.get(inputChipID) === 1) {
                return true;
            }

            if (states.get(inputChipID) === 0 && cyclic(inputChipID, chipMap, states)) {
                return true;
            }
        }
    }

    states.set(rootChipID, 2);

    return false;
}

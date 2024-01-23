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

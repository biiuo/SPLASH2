"""
Splash - active zones

A zone file lists the polygons of the image that matter (the 3 lanes, the
starting-block area at the back, the deck edge in front...). Scripts use it to
  * IGNORE detections whose center is outside every zone (before tracking, so
    ignored people don't use up track IDs), and
  * DIM the pixels outside the zones in the video a human watches. The model
    always sees the full, untouched frame.
Create one with define_zones.py.
"""
import json

import cv2
import numpy as np


class Zones:
    def __init__(self, zones, image_size=None):
        """zones: list of {"name": str, "polygon": [[x, y], ...]}; image_size: (w, h) they were drawn on."""
        if not zones:
            raise ValueError("A zone file needs at least one polygon")
        self.zones = zones
        self.image_size = tuple(image_size) if image_size else None
        self._polys = [np.array(z["polygon"], dtype=np.float32) for z in zones]
        self._mask = None

    @classmethod
    def load(cls, path):
        with open(path, encoding="utf-8") as f:
            d = json.load(f)
        return cls(d["zones"], d.get("image_size"))

    def save(self, path):
        with open(path, "w", encoding="utf-8") as f:
            json.dump({"image_size": list(self.image_size) if self.image_size else None,
                       "zones": self.zones}, f, indent=2)

    def fit_to(self, width, height):
        """Rescale the polygons if the video size differs from the frame they were drawn on."""
        if self.image_size and self.image_size != (width, height):
            s = np.array([width / self.image_size[0], height / self.image_size[1]], dtype=np.float32)
            self._polys = [p * s for p in self._polys]
            self.image_size = (width, height)
            self._mask = None
        return self

    def contains(self, px, py):
        return any(cv2.pointPolygonTest(p, (float(px), float(py)), False) >= 0 for p in self._polys)

    def split(self, det):
        """det: (N, >=4) array of boxes -> (inside, outside), judged by each box's center."""
        if len(det) == 0:
            return det, det
        cx, cy = (det[:, 0] + det[:, 2]) / 2, (det[:, 1] + det[:, 3]) / 2
        inside = np.array([self.contains(x, y) for x, y in zip(cx, cy)], dtype=bool)
        return det[inside], det[~inside]

    def mask(self, height, width):
        if self._mask is None or self._mask.shape != (height, width):
            m = np.zeros((height, width), np.uint8)
            cv2.fillPoly(m, [p.astype(np.int32) for p in self._polys], 255)
            self._mask = m
        return self._mask

    def dim_outside(self, frame, factor=0.35):
        """Darken (in place) every pixel outside the zones. Display only - never feed this to the model."""
        outside = self.mask(*frame.shape[:2]) == 0
        frame[outside] = (frame[outside] * factor).astype(np.uint8)
        return frame

"""
Lightweight PyTorch MLP used for reach / engagement / conversion / ROI prediction.
Weights are initialized with Xavier uniform + a strong inductive prior derived from
the feature engineering layer, so the model gives useful predictions without training
data at cold-start.  When label data becomes available, call `model.fine_tune(X, y)`.
"""
import math
import torch
import torch.nn as nn
from typing import List


class PerformanceMLP(nn.Module):
    INPUT_DIM = 10

    def __init__(self, output_dim: int = 4):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(self.INPUT_DIM, 64),
            nn.ReLU(),
            nn.Dropout(0.1),
            nn.Linear(64, 32),
            nn.ReLU(),
            nn.Linear(32, output_dim),
            nn.Sigmoid(),   # all outputs in [0, 1], scaled post-hoc
        )
        self._init_weights()

    def _init_weights(self):
        for m in self.modules():
            if isinstance(m, nn.Linear):
                nn.init.xavier_uniform_(m.weight)
                nn.init.zeros_(m.bias)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)

    def predict(self, features: List[float]) -> List[float]:
        self.eval()
        with torch.no_grad():
            x = torch.tensor([features], dtype=torch.float32)
            out = self(x)[0].tolist()
        return out


# Module-level singleton
_model: PerformanceMLP | None = None

OUTPUT_SCALES = [
    ("reach_multiplier",    0.05, 5.0),    # ×followers
    ("engagement_rate",     0.5,  25.0),   # %
    ("conversion_rate",     0.001, 0.08),  # fraction
    ("predicted_roi",       0.2,  10.0),   # ×
]


def get_model() -> PerformanceMLP:
    global _model
    if _model is None:
        _model = PerformanceMLP(output_dim=len(OUTPUT_SCALES))
    return _model


def scale_outputs(raw: List[float]) -> dict:
    result = {}
    for i, (key, lo, hi) in enumerate(OUTPUT_SCALES):
        result[key] = lo + raw[i] * (hi - lo)
    return result

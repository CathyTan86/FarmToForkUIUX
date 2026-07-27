import numpy as np
from typing import Dict, Any


class CarbonMatrixEngine:
    def __init__(self):
        self.sectors = ['agriculture', 'processing', 'logistics', 'energy']
        self.sector_idx = {sec: idx for idx, sec in enumerate(self.sectors)}

        # Technical Coefficient Matrix A — EXIOBASE-aligned sector transaction coefficients
        self.A = np.array([
            [0.12, 0.18, 0.05, 0.05],
            [0.10, 0.12, 0.08, 0.04],
            [0.08, 0.14, 0.10, 0.12],
            [0.15, 0.22, 0.38, 0.15]
        ])

        # Scope 1 Environmental Extension Vector (kg CO2e per $1 output)
        self.e = np.array([0.48, 0.75, 1.15, 2.40])
        self.I = np.eye(len(self.sectors))

        # Validate economic stability: Spectral radius must be < 1
        spectral_radius = np.max(np.abs(np.linalg.eigvals(self.A)))
        if spectral_radius >= 1.0:
            raise RuntimeError(
                f"CarbonMatrixEngine: Spectral radius of A is {spectral_radius:.4f} >= 1. "
                "The Leontief system is economically unstable."
            )

        # Guard against singular (I - A) before inversion
        try:
            self.L = np.linalg.inv(self.I - self.A)
        except np.linalg.LinAlgError:
            raise RuntimeError(
                "CarbonMatrixEngine: Technical coefficient matrix A produces a singular "
                "(I - A). Check MRIO input data."
            )

        # Pre-compute static tier matrices
        self.A_sq = np.linalg.matrix_power(self.A, 2)
        self.residual_matrix = self.L - self.I - self.A - self.A_sq

    def compute_footprint(self, demand_dict: Dict[str, float]) -> Dict[str, Any]:
        """
        Compute the full Leontief supply chain carbon footprint for a given
        final demand allocation vector.
        """
        y = np.zeros(len(self.sectors))
        for sector, value in demand_dict.items():
            if sector in self.sector_idx:
                if value < 0:
                    raise ValueError(
                        f"Demand allocation for sector '{sector}' must be "
                        f"non-negative, got {value}."
                    )
                y[self.sector_idx[sector]] = value

        # Total economic output across the supply network: x = L * y
        x = self.L @ y
        sector_emissions = self.e * x
        total_carbon = float(np.sum(sector_emissions))

        # Tier decomposition
        tier_0 = self.e @ y
        tier_1 = self.e @ (self.A @ y)
        tier_2 = self.e @ (self.A_sq @ y)
        tier_3_plus = self.e @ (self.residual_matrix @ y)

        return {
            "total_co2e_kg": round(total_carbon, 4),
            "by_sector": {
                sec: round(float(sector_emissions[idx]), 4)
                for sec, idx in self.sector_idx.items()
            },
            "supply_chain_tiers": {
                "tier_0_direct":        round(float(tier_0), 4),
                "tier_1_suppliers":     round(float(tier_1), 4),
                "tier_2_deep_suppliers":round(float(tier_2), 4),
                "tier_3_and_beyond":    round(max(0.0, float(tier_3_plus)), 4),
            }
        }

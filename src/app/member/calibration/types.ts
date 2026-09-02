export type CalibrationCriterion = {
  id: string;
  name: string;
  description: string;
  weight: number;
  required: boolean;
};

export type CalibrationDetail = {
  roundId: string;
  roundName: string;
  roundStatus: "PUBLISHED" | "ACTIVE";
  rubricId: string;
  rubricVersion: number;
  acknowledgedAt: string | null;
  criteria: CalibrationCriterion[];
};

export type CalibrationState = {
  roundId: string;
  rubricId: string;
  acknowledgedAt: string | null;
};

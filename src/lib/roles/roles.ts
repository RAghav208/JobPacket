import { detectSkills } from "../score-engine/extract";
import { defaultVocabulary } from "../score-engine/score";

/**
 * Suggest job-search roles from a CV.
 *
 * Deterministic and free: detects the candidate's skills, then maps skill
 * clusters to role titles, ranked by how many supporting skills are present.
 * No LLM needed — auto-extraction works offline. The user can always edit or
 * replace the suggestions with their own roles.
 */

interface RoleRule {
  role: string;
  skills: string[];
}

const ROLE_RULES: RoleRule[] = [
  { role: "Data Scientist", skills: ["Machine Learning", "Deep Learning", "Python", "Statistics", "scikit-learn", "Pandas", "NumPy"] },
  { role: "Machine Learning Engineer", skills: ["Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "Python"] },
  { role: "Data Analyst", skills: ["SQL", "Excel", "Tableau", "Power BI", "Pandas", "Data Analysis", "Statistics"] },
  { role: "Data Engineer", skills: ["SQL", "Python", "AWS", "GCP", "Azure"] },
  { role: "NLP Engineer", skills: ["Natural Language Processing", "Deep Learning", "Python"] },
  { role: "Frontend Developer", skills: ["JavaScript", "TypeScript", "React", "CSS", "HTML"] },
  { role: "Backend Developer", skills: ["Node.js", "Java", "Go", "SQL", "REST"] },
  { role: "Full Stack Developer", skills: ["JavaScript", "TypeScript", "React", "Node.js", "SQL"] },
  { role: "Software Engineer", skills: ["Java", "C++", "C", "Python", "Git"] },
];

export interface RoleSuggestion {
  role: string;
  /** Which of the candidate's skills support this role (shown to the user). */
  matched: string[];
}

export function suggestRoles(cvText: string, max = 5): RoleSuggestion[] {
  const present = new Set(detectSkills(cvText, defaultVocabulary).keys());
  return ROLE_RULES.map((r) => ({
    role: r.role,
    matched: r.skills.filter((s) => present.has(s)),
  }))
    .filter((r) => r.matched.length > 0)
    .sort((a, b) => b.matched.length - a.matched.length)
    .slice(0, max);
}

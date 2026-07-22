const { create, all } = require('mathjs');

// mathjs setup from ast-evaluator.service.ts
const math = create(all, { number: "BigNumber", precision: 20 });

// The data from my previous test
const sectionsForResponse = [
  {
    id: '39550c95-d449-4720-816b-6f2c87146e3c',
    name: 'A',
    sectionToken: 'SECTION_A',
    sortOrder: 0
  }
];

const evaluatorRows = [
  {
    rowToken: 'PORT_BILL',
    label: 'Port bill * GRT',
    formulaRaw: '100 * GRT',
    rowType: 'formula',
    subDescription: null,
    surchargeLabel: null,
    qualifier: null,
    surchargeFormula: null,
    constantValue: null,
    defaultValue: null,
    subComponents: null,
    aggregateTargetSectionId: null,
    sectionId: '39550c95-d449-4720-816b-6f2c87146e3c',
    isVisible: true,
    sortOrder: 0
  }
];

// Let's run DagValidatorService sortRows logic (simplified)
const sortedRows = evaluatorRows; // Only one row anyway

// Run AstEvaluatorService evaluate logic
const scope = {
  tokens: { GRT: 500 }
};
const sectionTokenMap = new Map();
sectionTokenMap.set('39550c95-d449-4720-816b-6f2c87146e3c', 'SECTION_A');

let evaluatedRows = [];
const evaluationErrors = [];

for (const row of sortedRows) {
  let value = 0;
  let errorMsg = null;
  
  if (row.rowType === "formula" && row.formulaRaw) {
    try {
      value = math.evaluate(row.formulaRaw, scope.tokens);
    } catch (err) {
      errorMsg = err.message;
    }
  } else {
    value = row.constantValue ?? row.defaultValue ?? 0;
  }
  
  scope.tokens[row.rowToken] = value;
  
  evaluatedRows.push({
    rowToken: row.rowToken,
    label: row.label,
    value: Number(value),
    sectionId: row.sectionId,
    isVisible: row.isVisible,
    sortOrder: row.sortOrder,
    error: errorMsg
  });
}

console.log("evaluatedRows:", evaluatedRows);

// Let's group by section like engine.controller.ts does
const sectionMap = new Map(sectionsForResponse.map(s => [s.id, s]));
const sectionResultMap = new Map();

for (const s of sectionsForResponse) {
  sectionResultMap.set(s.id, { ...s, rows: [] });
}

for (const row of evaluatedRows) {
  if (!row.sectionId) continue;
  const target = sectionResultMap.get(row.sectionId);
  if (target) {
    target.rows.push(row);
  }
}

const sections = Array.from(sectionResultMap.values()).sort((a, b) => a.sortOrder - b.sortOrder);
console.log("sections:", JSON.stringify(sections, null, 2));

process.exit(0);

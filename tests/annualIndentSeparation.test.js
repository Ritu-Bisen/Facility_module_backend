const assert = require('assert');
const test = require('node:test');

test('Separated Annual Indent Modules Verification', async (t) => {
  await t.test('1. Non-EDL Annual Indent Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/nonEdlAnnualIndentModel');
    const controller = require('../src/controllers/nonEdlAnnualIndentController');
    const routes = require('../src/routes/nonEdlAnnualIndentRoutes');

    assert.ok(typeof model.getDownloadNonEdlFormatData === 'function', 'model.getDownloadNonEdlFormatData exists');
    assert.ok(typeof model.getNonEdlUploadForwardList === 'function', 'model.getNonEdlUploadForwardList exists');
    assert.ok(typeof model.getNonEdlCreateIndentHeader === 'function', 'model.getNonEdlCreateIndentHeader exists');
    assert.ok(typeof model.generateNonEdlIndentHeader === 'function', 'model.generateNonEdlIndentHeader exists');
    assert.ok(typeof model.getNonEdlCreateIndentItems === 'function', 'model.getNonEdlCreateIndentItems exists');
    assert.ok(typeof model.uploadExcelNonEdlIndentItems === 'function', 'model.uploadExcelNonEdlIndentItems exists');
    assert.ok(typeof model.freezeNonEdlIndent === 'function', 'model.freezeNonEdlIndent exists');
    assert.ok(typeof model.deleteNonEdlIndent === 'function', 'model.deleteNonEdlIndent exists');
    assert.ok(typeof model.getNonEdlCreateFinYears === 'function', 'model.getNonEdlCreateFinYears exists');

    assert.ok(typeof controller.getDownloadNonEdlFormatData === 'function', 'controller.getDownloadNonEdlFormatData exists');
    assert.ok(typeof controller.getNonEdlUploadForwardList === 'function', 'controller.getNonEdlUploadForwardList exists');
    assert.ok(typeof controller.getNonEdlCreateIndentHeader === 'function', 'controller.getNonEdlCreateIndentHeader exists');
    assert.ok(typeof controller.generateNonEdlIndentHeader === 'function', 'controller.generateNonEdlIndentHeader exists');
    assert.ok(typeof controller.getNonEdlCreateIndentItems === 'function', 'controller.getNonEdlCreateIndentItems exists');
    assert.ok(typeof controller.uploadExcelNonEdlIndentItems === 'function', 'controller.uploadExcelNonEdlIndentItems exists');
    assert.ok(typeof controller.freezeNonEdlIndent === 'function', 'controller.freezeNonEdlIndent exists');
    assert.ok(typeof controller.deleteNonEdlIndent === 'function', 'controller.deleteNonEdlIndent exists');
    assert.ok(typeof controller.getNonEdlCreateFinYears === 'function', 'controller.getNonEdlCreateFinYears exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('2. Reagent Non-EDL Consumable & Kits Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/reagentNonEdlIndentModel');
    const controller = require('../src/controllers/reagentNonEdlIndentController');
    const routes = require('../src/routes/reagentNonEdlIndentRoutes');

    assert.ok(typeof model.getDownloadReagentNonEdlFormatData === 'function', 'model.getDownloadReagentNonEdlFormatData exists');
    assert.ok(typeof model.getReagentUploadForwardList === 'function', 'model.getReagentUploadForwardList exists');
    assert.ok(typeof model.getReagentCreateIndentHeader === 'function', 'model.getReagentCreateIndentHeader exists');
    assert.ok(typeof model.generateReagentIndentHeader === 'function', 'model.generateReagentIndentHeader exists');
    assert.ok(typeof model.getReagentCreateIndentItems === 'function', 'model.getReagentCreateIndentItems exists');
    assert.ok(typeof model.uploadExcelReagentIndentItems === 'function', 'model.uploadExcelReagentIndentItems exists');
    assert.ok(typeof model.freezeReagentIndent === 'function', 'model.freezeReagentIndent exists');
    assert.ok(typeof model.deleteReagentIndent === 'function', 'model.deleteReagentIndent exists');
    assert.ok(typeof model.getReagentCreateFinYears === 'function', 'model.getReagentCreateFinYears exists');

    assert.ok(typeof controller.getDownloadReagentNonEdlFormatData === 'function', 'controller.getDownloadReagentNonEdlFormatData exists');
    assert.ok(typeof controller.getReagentUploadForwardList === 'function', 'controller.getReagentUploadForwardList exists');
    assert.ok(typeof controller.getReagentCreateIndentHeader === 'function', 'controller.getReagentCreateIndentHeader exists');
    assert.ok(typeof controller.generateReagentIndentHeader === 'function', 'controller.generateReagentIndentHeader exists');
    assert.ok(typeof controller.getReagentCreateIndentItems === 'function', 'controller.getReagentCreateIndentItems exists');
    assert.ok(typeof controller.uploadExcelReagentIndentItems === 'function', 'controller.uploadExcelReagentIndentItems exists');
    assert.ok(typeof controller.freezeReagentIndent === 'function', 'controller.freezeReagentIndent exists');
    assert.ok(typeof controller.deleteReagentIndent === 'function', 'controller.deleteReagentIndent exists');
    assert.ok(typeof controller.getReagentCreateFinYears === 'function', 'controller.getReagentCreateFinYears exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('3. AYUSH Annual Indent Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/ayushAnnualIndentModel');
    const controller = require('../src/controllers/ayushAnnualIndentController');
    const routes = require('../src/routes/ayushAnnualIndentRoutes');

    assert.ok(typeof model.getAyushDownloadFormatData === 'function', 'model.getAyushDownloadFormatData exists');
    assert.ok(typeof model.getDaoForwardedList === 'function', 'model.getDaoForwardedList exists');
    assert.ok(typeof model.getDaoDetailItems === 'function', 'model.getDaoDetailItems exists');
    assert.ok(typeof model.getDaoApprovalList === 'function', 'model.getDaoApprovalList exists');
    assert.ok(typeof model.getDaoIndentItems === 'function', 'model.getDaoIndentItems exists');
    assert.ok(typeof model.approveDaoIndent === 'function', 'model.approveDaoIndent exists');
    assert.ok(typeof model.getDaoStatusReport === 'function', 'model.getDaoStatusReport exists');
    assert.ok(typeof model.getDaoItemWiseAi === 'function', 'model.getDaoItemWiseAi exists');

    assert.ok(typeof controller.getAyushDownloadFormatData === 'function', 'controller.getAyushDownloadFormatData exists');
    assert.ok(typeof controller.getDaoForwardedList === 'function', 'controller.getDaoForwardedList exists');
    assert.ok(typeof controller.getDaoDetailItems === 'function', 'controller.getDaoDetailItems exists');
    assert.ok(typeof controller.getDaoApprovalList === 'function', 'controller.getDaoApprovalList exists');
    assert.ok(typeof controller.getDaoIndentItems === 'function', 'controller.getDaoIndentItems exists');
    assert.ok(typeof controller.approveDaoIndent === 'function', 'controller.approveDaoIndent exists');
    assert.ok(typeof controller.getDaoStatusReport === 'function', 'controller.getDaoStatusReport exists');
    assert.ok(typeof controller.getDaoItemWiseAi === 'function', 'controller.getDaoItemWiseAi exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('4. Medical College AI Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/medicalCollegeAiModel');
    const controller = require('../src/controllers/medicalCollegeAiController');
    const routes = require('../src/routes/medicalCollegeAiRoutes');

    assert.ok(typeof model.getMedicalCollegeAiDropdowns === 'function', 'model.getMedicalCollegeAiDropdowns exists');
    assert.ok(typeof model.getMedicalCollegeAiReport === 'function', 'model.getMedicalCollegeAiReport exists');
    assert.ok(typeof model.getMcAiVsIssuanceDropdowns === 'function', 'model.getMcAiVsIssuanceDropdowns exists');
    assert.ok(typeof model.getMcAiVsIssuanceReport === 'function', 'model.getMcAiVsIssuanceReport exists');
    assert.ok(typeof model.getMcHospitalAiVsIssuance === 'function', 'model.getMcHospitalAiVsIssuance exists');

    assert.ok(typeof controller.getMedicalCollegeAiDropdowns === 'function', 'controller.getMedicalCollegeAiDropdowns exists');
    assert.ok(typeof controller.getMedicalCollegeAiReport === 'function', 'controller.getMedicalCollegeAiReport exists');
    assert.ok(typeof controller.getMcAiVsIssuanceDropdowns === 'function', 'controller.getMcAiVsIssuanceDropdowns exists');
    assert.ok(typeof controller.getMcAiVsIssuanceReport === 'function', 'controller.getMcAiVsIssuanceReport exists');
    assert.ok(typeof controller.getMcHospitalAiVsIssuance === 'function', 'controller.getMcHospitalAiVsIssuance exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('5. DH Upload & Forward Indent (Image 1) Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/dhAnnualIndentModel');
    const controller = require('../src/controllers/dhAnnualIndentController');
    const routes = require('../src/routes/dhAnnualIndentRoutes');

    assert.ok(typeof model.getDhUploadForwardFinYears === 'function', 'model.getDhUploadForwardFinYears exists');
    assert.ok(typeof model.getDhUploadForwardList === 'function', 'model.getDhUploadForwardList exists');
    assert.ok(typeof model.getDhCreateIndentHeader === 'function', 'model.getDhCreateIndentHeader exists');
    assert.ok(typeof model.generateDhIndentHeader === 'function', 'model.generateDhIndentHeader exists');
    assert.ok(typeof model.getDhCreateIndentItems === 'function', 'model.getDhCreateIndentItems exists');
    assert.ok(typeof model.uploadExcelDhIndentItems === 'function', 'model.uploadExcelDhIndentItems exists');
    assert.ok(typeof model.freezeDhIndent === 'function', 'model.freezeDhIndent exists');
    assert.ok(typeof model.deleteDhIndent === 'function', 'model.deleteDhIndent exists');
    assert.ok(typeof model.getDhDownloadFormatData === 'function', 'model.getDhDownloadFormatData exists');
    assert.ok(typeof model.getDhIndentPdfItems === 'function', 'model.getDhIndentPdfItems exists');

    assert.ok(typeof controller.getDhUploadForwardFinYears === 'function', 'controller.getDhUploadForwardFinYears exists');
    assert.ok(typeof controller.getDhUploadForwardList === 'function', 'controller.getDhUploadForwardList exists');
    assert.ok(typeof controller.getDhCreateIndentHeader === 'function', 'controller.getDhCreateIndentHeader exists');
    assert.ok(typeof controller.generateDhIndentHeader === 'function', 'controller.generateDhIndentHeader exists');
    assert.ok(typeof controller.getDhCreateIndentItems === 'function', 'controller.getDhCreateIndentItems exists');
    assert.ok(typeof controller.uploadExcelDhIndentItems === 'function', 'controller.uploadExcelDhIndentItems exists');
    assert.ok(typeof controller.freezeDhIndent === 'function', 'controller.freezeDhIndent exists');
    assert.ok(typeof controller.deleteDhIndent === 'function', 'controller.deleteDhIndent exists');
    assert.ok(typeof controller.getDhDownloadFormatData === 'function', 'controller.getDhDownloadFormatData exists');
    assert.ok(typeof controller.getDhIndentPdfItems === 'function', 'controller.getDhIndentPdfItems exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('6. CHC Approval of Forwarded Indents Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/chcAnnualIndentModel');
    const controller = require('../src/controllers/chcAnnualIndentController');
    const routes = require('../src/routes/chcAnnualIndentRoutes');

    assert.ok(typeof model.getChcFinYears === 'function', 'model.getChcFinYears exists');
    assert.ok(typeof model.getChcDrugs === 'function', 'model.getChcDrugs exists');
    assert.ok(typeof model.getChcFacilityItems === 'function', 'model.getChcFacilityItems exists');
    assert.ok(typeof model.approveChcItem === 'function', 'model.approveChcItem exists');
    assert.ok(typeof model.approveChcBatchItems === 'function', 'model.approveChcBatchItems exists');
    assert.ok(typeof model.getChcDispatchDetails === 'function', 'model.getChcDispatchDetails exists');
    assert.ok(typeof model.saveChcDispatchDetails === 'function', 'model.saveChcDispatchDetails exists');
    assert.ok(typeof model.freezeChcIndent === 'function', 'model.freezeChcIndent exists');

    assert.ok(typeof controller.getChcFinYears === 'function', 'controller.getChcFinYears exists');
    assert.ok(typeof controller.getChcDrugs === 'function', 'controller.getChcDrugs exists');
    assert.ok(typeof controller.getChcFacilityItems === 'function', 'controller.getChcFacilityItems exists');
    assert.ok(typeof controller.approveChcItem === 'function', 'controller.approveChcItem exists');
    assert.ok(typeof controller.approveChcBatchItems === 'function', 'controller.approveChcBatchItems exists');
    assert.ok(typeof controller.getChcDispatchDetails === 'function', 'controller.getChcDispatchDetails exists');
    assert.ok(typeof controller.saveChcDispatchDetails === 'function', 'controller.saveChcDispatchDetails exists');
    assert.ok(typeof controller.freezeChcIndent === 'function', 'controller.freezeChcIndent exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('7. DAO Approval of Forwarded Indent of Ayush Facilities Model, Controller, and Routes load properly', () => {
    const model = require('../src/models/daoAnnualIndentModel');
    const controller = require('../src/controllers/daoAnnualIndentController');
    const routes = require('../src/routes/daoAnnualIndentRoutes');

    assert.ok(typeof model.getDaoFinYears === 'function', 'model.getDaoFinYears exists');
    assert.ok(typeof model.getDaoCategories === 'function', 'model.getDaoCategories exists');
    assert.ok(typeof model.getDaoDrugs === 'function', 'model.getDaoDrugs exists');
    assert.ok(typeof model.getDaoFacilityItems === 'function', 'model.getDaoFacilityItems exists');
    assert.ok(typeof model.approveDaoItem === 'function', 'model.approveDaoItem exists');
    assert.ok(typeof model.approveDaoBatchItems === 'function', 'model.approveDaoBatchItems exists');
    assert.ok(typeof model.getDaoDispatchDetails === 'function', 'model.getDaoDispatchDetails exists');
    assert.ok(typeof model.saveDaoDispatchDetails === 'function', 'model.saveDaoDispatchDetails exists');
    assert.ok(typeof model.freezeDaoIndent === 'function', 'model.freezeDaoIndent exists');

    assert.ok(typeof controller.getFinYears === 'function', 'controller.getFinYears exists');
    assert.ok(typeof controller.getCategories === 'function', 'controller.getCategories exists');
    assert.ok(typeof controller.getDrugs === 'function', 'controller.getDrugs exists');
    assert.ok(typeof controller.getFacilityItems === 'function', 'controller.getFacilityItems exists');
    assert.ok(typeof controller.approveItem === 'function', 'controller.approveItem exists');
    assert.ok(typeof controller.approveBatchItems === 'function', 'controller.approveBatchItems exists');
    assert.ok(typeof controller.getDispatchDetails === 'function', 'controller.getDispatchDetails exists');
    assert.ok(typeof controller.saveDispatchDetails === 'function', 'controller.saveDispatchDetails exists');
    assert.ok(typeof controller.freezeIndent === 'function', 'controller.freezeIndent exists');
    assert.ok(routes, 'routes exist');
  });

  await t.test('8. Main app and Core annual indent backward compatibility', () => {
    const app = require('../src/app');
    assert.ok(app, 'app loaded');

    const coreModel = require('../src/models/annualIndentModel');
    const coreController = require('../src/controllers/annualIndentController');
    const coreRoutes = require('../src/routes/annualIndentRoutes');

    assert.ok(typeof coreModel.getIndentItems === 'function');
    assert.ok(typeof coreModel.getDownloadNonEdlFormatData === 'function', 'Non-EDL re-exported on core model');
    assert.ok(typeof coreModel.getDownloadReagentNonEdlFormatData === 'function', 'Reagent re-exported on core model');
    assert.ok(typeof coreModel.getAyushDownloadFormatData === 'function', 'Ayush re-exported on core model');
    assert.ok(typeof coreModel.getMedicalCollegeAiReport === 'function', 'Medical College AI re-exported on core model');
    assert.ok(typeof coreModel.getChcDrugs === 'function', 'CHC re-exported on core model');

    assert.ok(typeof coreController.getItems === 'function');
    assert.ok(typeof coreController.getDownloadNonEdlFormatData === 'function', 'Non-EDL re-exported on core controller');
    assert.ok(typeof coreController.getDownloadReagentNonEdlFormatData === 'function', 'Reagent re-exported on core controller');
    assert.ok(typeof coreController.getAyushDownloadFormatData === 'function', 'Ayush re-exported on core controller');
    assert.ok(typeof coreController.getMedicalCollegeAiReport === 'function', 'Medical College AI re-exported on core controller');
    assert.ok(typeof coreController.getChcDrugs === 'function', 'CHC re-exported on core controller');
    assert.ok(coreRoutes, 'core routes loaded');
  });
});

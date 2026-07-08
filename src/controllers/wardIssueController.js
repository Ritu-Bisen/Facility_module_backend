const wardIssueModel = require('../models/wardIssueModel');
const oracledb = require('oracledb');
const db = require('../config/db');

async function getWards(req, res) {
    try {
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const wards = await wardIssueModel.getWards(facilityId);
        res.json(wards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function generateIssueNo(req, res) {
    try {
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const issueNo = await wardIssueModel.generateIssueNo(facilityId);
        res.json({ issueNo });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getItems(req, res) {
    try {
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const items = await wardIssueModel.getItems(facilityId);
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// GET /api/ward-issue/mas-items
async function getMasItems(req, res) {
    try {
        const items = await wardIssueModel.getMasItems();
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

// GET /api/ward-issue/facility-stock?facilityId=123&itemId=456
async function getFacilityStock(req, res) {
    try {
        const { facilityId, itemId } = req.query;
        if (!facilityId || !itemId) {
            return res.status(400).json({ error: 'facilityId and itemId are required' });
        }
        const stock = await wardIssueModel.getFacilityStock(facilityId, itemId);
        res.json({ facilityStock: stock });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getHeaderInfo(req, res) {
    try {
        const { id } = req.params;
        const info = await wardIssueModel.getHeaderInfo(id);
        if (!info) return res.status(404).json({ error: "Not found" });
        res.json(info);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function saveHeaderInfo(req, res) {
    try {
        const data = req.body; // should include issueId (optional), facilityId, wardId, issueNo, requestedBy, requestedDt, issueDate
        if (!data.facilityId || !data.wardId || !data.issueNo) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        let issueId;
        if (!data.issueId || data.issueId == 0) {
            issueId = await wardIssueModel.createHeaderInfo(data);
        } else {
            await wardIssueModel.updateHeaderInfo(data);
            issueId = data.issueId;
        }

        res.json({ message: "Updated Successfully", issueId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getIssueItems(req, res) {
    try {
        const { id } = req.params;
        const { facilityId } = req.query;
        if (!facilityId) {
            return res.status(400).json({ error: "facilityId is required" });
        }
        const items = await wardIssueModel.getIssueItems(id, facilityId);
        res.json(items);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function saveIssueItem(req, res) {
    try {
        const { id } = req.params; // issueId
        const data = req.body; // itemId, curStock, allotted, issueQty, issueItemId (optional)
        data.issueId = id;

        // Validations
        const multiple = await wardIssueModel.getMultiple(data.itemId);
        if (data.issueQty % multiple !== 0 || data.issueQty == 0) {
            return res.status(400).json({ error: `Enter Quantity Should be Multiple of ${multiple}` });
        }

        if (!data.issueItemId || data.issueItemId == 0) {
            const isDuplicate = await wardIssueModel.checkDuplicateItem(id, data.itemId);
            if (isDuplicate) {
                return res.status(400).json({ error: "it alredy in your item list update then qty" });
            }
        }

        if (parseFloat(data.allotted) > parseFloat(data.curStock)) {
            return res.status(400).json({ error: "Requested Qty cannot be greater than Stock" });
        }

        if (parseFloat(data.issueQty) > parseFloat(data.allotted)) {
            return res.status(400).json({ error: "Issue Qty cannot be greater than Requested Qty" });
        }

        let issueItemId;
        if (!data.issueItemId || data.issueItemId == 0) {
            issueItemId = await wardIssueModel.addIssueItem(data);
        } else {
            await wardIssueModel.updateIssueItem(data);
            issueItemId = data.issueItemId;
        }

        // Run FEFO batch allocation
        await wardIssueModel.updateFacilityAllotQtyOP(req.user.facilityId, data.itemId, data.issueQty, issueItemId);

        res.json({ message: "Saved Successfully", issueItemId });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function updateIssueItem(req, res) {
    try {
        const { issueItemId } = req.params;
        const data = req.body; // itemId, curStock, allotted, issueQty, issueId
        data.issueItemId = issueItemId;

        // Validations
        const multiple = await wardIssueModel.getMultiple(data.itemId);
        if (data.issueQty % multiple !== 0 || data.issueQty == 0) {
            return res.status(400).json({ error: `Enter Quantity Should be Multiple of ${multiple}` });
        }

        if (parseFloat(data.allotted) > parseFloat(data.curStock)) {
            return res.status(400).json({ error: "Requested Qty cannot be greater than Stock" });
        }

        if (parseFloat(data.issueQty) > parseFloat(data.allotted)) {
            return res.status(400).json({ error: "Issue Qty cannot be greater than Requested Qty" });
        }

        await wardIssueModel.updateIssueItem(data);

        // Run FEFO batch allocation
        await wardIssueModel.updateFacilityAllotQtyOP(req.user.facilityId, data.itemId, data.issueQty, issueItemId);

        res.json({ message: "Updated Successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteIssueItem(req, res) {
    try {
        const { issueItemId } = req.params;
        await wardIssueModel.deleteIssueItem(Number(issueItemId));
        res.json({ message: "Item Deleted" });
    } catch (error) {
        res.status(500).json({ error: "Delete not allowed, references found" });
    }
}

async function completeIssue(req, res) {
    try {
        const { id } = req.params;
        await wardIssueModel.completeIssue(Number(id));
        res.json({ message: "Status changed successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function deleteIssue(req, res) {
    try {
        const { id } = req.params;
        await wardIssueModel.deleteIssue(Number(id));
        res.json({ message: "Deleted successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getBatches(req, res) {
  try {
    const { issueItemId, itemId } = req.params;
    const facilityId = req.user.facilityId;

    const query = `
      SELECT
          ri.FacReceiptItemID,
          rb.BatchNo,
          rb.MfgDate,
          rb.ExpDate,
          NVL(a.IssueQty,0) IssueQty,
          rb.Inwno,
          NVL(mr.locationno,'0') StockLocation
      FROM tbfacilityoutwards a
      INNER JOIN tbfacilityissueitems tbi
          ON tbi.issueitemid = a.issueitemid
      INNER JOIN tbfacilityissues tb
          ON tb.issueid = tbi.issueid
      INNER JOIN tbFacilityReceiptBatches rb
          ON rb.inwno = a.inwno
          AND rb.facreceiptitemid = a.facreceiptitemid
          AND (rb.whissueblock IS NULL OR rb.whissueblock = 0)
      LEFT JOIN masracks mr
          ON mr.rackid = rb.StockLocation
      INNER JOIN tbfacilityreceiptitems ri
          ON ri.facreceiptitemid = rb.facreceiptitemid
      WHERE tb.FacilityID = :facilityId
      AND tbi.IssueItemID = :issueItemId
      AND tbi.ItemID = :itemId
      ORDER BY rb.expdate
    `;

    const result = await db.execute(
      query,
      {
        facilityId,
        issueItemId,
        itemId,
      },
      {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      }
    );

    return res.status(200).json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
}

async function getIncompleteIssue(req, res) {
    try {
        const facilityId = req.user.facilityId;
        const issue = await wardIssueModel.getIncompleteIssue(facilityId);
        res.json(issue || null);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports = {
    getWards,
    generateIssueNo,
    getItems,
    getMasItems,
    getFacilityStock,
    getHeaderInfo,
    saveHeaderInfo,
    getIssueItems,
    saveIssueItem,
    updateIssueItem,
    deleteIssueItem,
    completeIssue,
    deleteIssue,
    getBatches,
    getIncompleteIssue
};

async function getAccYears(req, res) {
    try {
        const years = await wardIssueModel.getAccYears();
        res.json(years);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function checkOpeningStock(req, res) {
    try {
        const facilityId = req.user.facilityId;
        const exists = await wardIssueModel.checkOpeningStockReceipt(facilityId);
        res.json({ exists });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getWardIssuesList(req, res) {
    try {
        const facilityId = req.user.facilityId;
        const { status, accYrSetId, itemId } = req.query;
        const list = await wardIssueModel.getWardIssuesList(facilityId, status, accYrSetId, itemId);
        res.json(list);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getReturnsWards(req, res) {
    try {
        const facilityId = req.user.facilityId;
        const wards = await wardIssueModel.getReturnsWards(facilityId);
        res.json(wards);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

async function getReturnsReceiptsList(req, res) {
    try {
        const facilityId = req.user.facilityId;
        const { wardId, status, accYrSetId, itemId } = req.query;
        if (!wardId) {
            return res.status(400).json({ error: "wardId is required" });
        }
        const receipts = await wardIssueModel.getReturnsReceiptsList(facilityId, wardId, status, accYrSetId, itemId);
        res.json(receipts);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports.getAccYears = getAccYears;
module.exports.checkOpeningStock = checkOpeningStock;
module.exports.getWardIssuesList = getWardIssuesList;
module.exports.getReturnsWards = getReturnsWards;
module.exports.getReturnsReceiptsList = getReturnsReceiptsList;

async function getPrintDetails(req, res) {
    try {
        const { id } = req.params;
        const facilityId = req.user.facilityId;
        const details = await wardIssueModel.getPrintDetails(id, facilityId);
        if (!details) return res.status(404).json({ error: "Ward Issue not found" });
        res.json(details);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}

module.exports.getPrintDetails = getPrintDetails;

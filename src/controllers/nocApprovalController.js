const nocApprovalModel = require('../models/nocApprovalModel');

async function getPendingNocItems(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const items = await nocApprovalModel.getPendingNocItems(facilityId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function approveNocItems(req, res) {
  try {
    const { items } = req.body;
    const userId = req.user.id || req.user.userId || 1; // Fallback if not available
    const otp = '1234'; // Static OTP for database backward compatibility

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items selected for approval' });
    }

    const dt1 = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    let msggreater = false;

    for (const item of items) {
      const sr = item.sr;
      const aprQty = Number(item.cmhoApprovedQty) || 0;
      const remarks = item.cmhoRemarks || '';
      const facReqQtyNoc = Number(item.nocQtyNos) || 0;

      if (sr && sr !== '0' && aprQty !== 0) {
        if (aprQty <= facReqQtyNoc) {
          const finalAprQty = aprQty / (Number(item.unitCount) || 1);
          await nocApprovalModel.approveItem({
            sr,
            aprQty: finalAprQty,
            remarks,
            userId,
            otp,
            dt1
          });
        } else {
          msggreater = true;
        }
      }
    }

    if (msggreater) {
      res.json({ message: 'Approved Successfully, Some Item cannot be greater than NOC Applied QTY, Please Correct QTY and Save it again' });
    } else {
      res.json({ message: 'Approved Successfully' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function rejectNocItems(req, res) {
  try {
    const { items } = req.body;
    const userId = req.user.id || req.user.userId || 1; 
    const otp = '1234'; // Static OTP for database backward compatibility

    if (!items || !items.length) {
      return res.status(400).json({ error: 'No items selected for rejection' });
    }

    const dt1 = new Date().toLocaleString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true
    });

    for (const item of items) {
      const sr = item.sr;
      const originalRemarks = item.cmhoRemarks || '';
      const remarks = 'Rejected by CMHO. ' + originalRemarks;

      if (sr && sr !== '0') {
        await nocApprovalModel.rejectItem({
          sr,
          remarks,
          userId,
          otp,
          dt1
        });
      }
    }

    res.json({ message: 'Rejected Successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

async function getFacilityWiseCurrentStock(req, res) {
  try {
    const facilityId = req.user.facilityId;
    const { itemId } = req.params;
    if (!itemId) {
      return res.status(400).json({ error: 'Item ID is required' });
    }
    const items = await nocApprovalModel.getFacilityWiseCurrentStock(facilityId, itemId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}

module.exports = {
  getPendingNocItems,
  approveNocItems,
  rejectNocItems,
  getFacilityWiseCurrentStock
};

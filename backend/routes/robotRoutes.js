const express = require('express');
const router = express.Router();
const robotController = require('../controllers/robotController');

// Botun durumunu güncelleyen ve mail tetikleyen route
router.put('/:id/status', robotController.updateRobotStatus); 

// Önceki günlerden kalan GET, POST gibi işlemlerin varsa onları da alt alta ekleyebilirsin:
// router.get('/', robotController.getAllRobots);
// router.post('/', robotController.createRobot);

module.exports = router;
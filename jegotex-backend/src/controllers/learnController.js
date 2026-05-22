const db = require("../config/db");

// INSERT PRODUCT
const createLearn = async (req, res) => {
  try {
    const {
      product,
      type,
      colour,
      weight,
      quantity
    } = req.body;

    const query = `
      INSERT INTO learn
      (product, type, colour, weight, quantity)
      VALUES (?, ?, ?, ?, ?)
    `;

    const [result] = await db.execute(query, [
      product,
      type,
      colour,
      weight,
      quantity
    ]);

    res.status(201).json({
      success: true,
      message: "Data inserted successfully",
      insertedId: result.insertId
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

// GET ALL DATA
const getLearn = async (req, res) => {
  try {

    const query = `SELECT * FROM learn`;

    const [rows] = await db.execute(query);

    res.status(200).json({
      success: true,
      count: rows.length,
      data: rows,
      
  });

  } catch (error) {

    res.status(500).json({
      success: false,
      message: error.message
    });

  }
};

module.exports = {
  createLearn,
    getLearn

};

const db = require("../config/dbconnection");

const LateFee = {
    Get_Late_Fee_Amount: async function() {
        try {
            // Check if table exists
            const [tables] = await db.promise().query("SHOW TABLES LIKE 'late_fee_settings'");
            if (tables.length === 0) {
                // Create table if it doesn't exist
                await db.promise().query(`
                    CREATE TABLE late_fee_settings (
                        id INT AUTO_INCREMENT PRIMARY KEY,
                        setting_key VARCHAR(50) UNIQUE,
                        setting_value DECIMAL(10,2)
                    )
                `);
                // Insert default value
                await db.promise().query("INSERT INTO late_fee_settings (setting_key, setting_value) VALUES ('late_fee_amount', 200.00)");
            }

            const [rows] = await db.promise().query("SELECT setting_value FROM late_fee_settings WHERE setting_key = 'late_fee_amount' LIMIT 1");
            if (rows.length > 0) {
                return rows[0].setting_value;
            }
            return 200.00; // Fallback
        } catch (error) {
            console.error("Error in Get_Late_Fee_Amount:", error);
            return 200.00; // Fallback
        }
    }
};

module.exports = LateFee;

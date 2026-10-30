var db = require('../config/dbconnection');
const storedProcedure = require('../helpers/stored-procedure');

class TransactionError extends Error {
    constructor(message, originalError) {
        super(message);
        this.name = 'TransactionError';
        this.originalError = originalError;
    }
}

async function startTransaction() {
    const pool = db.promise();
    let connection;
    try {
        connection = await pool.getConnection();
        
        // Set isolation level before starting transaction
        await connection.query('SET SESSION TRANSACTION ISOLATION LEVEL READ COMMITTED');
        
        // Now start the transaction
        await connection.beginTransaction();
        
        return connection;
    } catch (error) {
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                console.error('Connection Release Error:', releaseError);
            }
        }
        console.error('Start Transaction Error:', error);
        throw new TransactionError('Failed to start transaction', error);
    }
}

async function executeStoredProcedure(connection, procedureName, parameters, options = {}) {
    try {
        const sp = new storedProcedure(procedureName, parameters, connection, options);
        return options.stream ? await sp.streamResult() : await sp.result();
    } catch (error) {
        console.error('Execute SP Error:', error);
        throw error; 
    }
}
 
async function getmultipleSP(procedureName, parameters, options = {}) {
    const promisePool = db.promise();
    const conn = await promisePool.getConnection();
    const queryStart = process.hrtime();
    try {
        // Set sql_mode on THIS connection so the SP CALL uses the same session
        await conn.query(
            "SET SESSION sql_mode = 'STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'"
        );

        const [results] = await conn.query(
            `CALL ${procedureName}(${parameters.map(() => '?').join(',')})`,
            parameters
        );

        const queryDuration = process.hrtime(queryStart);
        const ms = queryDuration[0] * 1000 + queryDuration[1] / 1e6;
        if (ms > 1000) {
            console.warn(`Slow multiple SP detected (${ms.toFixed(2)}ms): ${procedureName}`);
        }

        return results;
    } catch (error) {
        console.error('Get Multiple SP Error:', {
            procedure: procedureName,
            error: error.message,
            params: JSON.stringify(parameters)
        });
        throw error;
    } finally {
        conn.release();
    }
}

async function executeTransaction(procedureName, parameters, options = {}) {
    let connection;
    const transactionStart = process.hrtime();

    try {
        connection = await startTransaction();
        const result = await executeStoredProcedure(connection, procedureName, parameters, options);
        await connection.commit();

        const duration = process.hrtime(transactionStart);
        const ms = duration[0] * 1000 + duration[1] / 1e6;
        if (ms > 2000) {
            console.warn(`Long transaction detected (${ms.toFixed(2)}ms): ${procedureName}`);
        }

        return result;
    } catch (error) {
        console.error('Execute Transaction Error:', {
            procedure: procedureName,
            error: error.message,
            duration: process.hrtime(transactionStart)
        });

        if (connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                console.error('Rollback Error:', rollbackError);
            }
        }
        throw error;
    } finally {
        if (connection) {
            try {
                connection.release();
            } catch (releaseError) {
                console.error('Connection Release Error:', releaseError);
            }
        }
    }
}

async function executeBatchTransaction(procedures) {
    let connection;
    try {
        connection = await startTransaction();
        
        const results = [];
        for (const proc of procedures) {
            const result = await executeStoredProcedure(
                connection, 
                proc.name, 
                proc.parameters, 
                proc.options
            );
            results.push(result);
        }
        
        await connection.commit();
        return results;
    } catch (error) {
        if (connection) await connection.rollback();
        throw error;
    } finally {
        if (connection) connection.release();
    }
}

module.exports = {
    executeTransaction,
    getmultipleSP,
    executeBatchTransaction,
    TransactionError
};



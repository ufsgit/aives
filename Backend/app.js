require('dotenv').config();
var db = require('./config/dbconnection'); // Add this for database connection
const { exec } = require('child_process'); // Add this for PM2 commands
const util = require('util');

const express = require('express');
const createError = require('http-errors');
const jwt = require('./helpers/jwt');
const path = require('path');
const logger = require('morgan');
const cors = require('cors');
const http = require('http');
const { Server } = require("socket.io");
const rateLimiter = require('./helpers/rateLimiter');  // Use this consistent naming

 
// Import route handlers
const indexRouter = require('./routes/index');
const loginRouter = require('./routes/Login');
const categoryRouter = require('./routes/course_category');
const userRouter = require('./routes/user');
const studentRouter = require('./routes/student');
const courseRouter = require('./routes/course');
const teacherRouter = require('./routes/teacher');
const cartRouter = require('./routes/cart'); 
const BatchRouter = require('./routes/Batch'); 
const ModuleRouter = require('./routes/course_module'); 
const chatRouter = require('./routes/chat'); 
const paymentRouter = require('./routes/payment'); 
const examRouter = require('./routes/exam');  
const FeesRouter = require('./routes/fees');  
const ExpenseRouter = require('./routes/Expense');
const ReportsRouter = require('./routes/Reports');
const IncomeRouter = require('./routes/Income');
const LateFeeRouter = require('./routes/LateFee');
const EmailTemplateRouter = require('./routes/email_template');
const webhookRouter = require('./routes/webhook');
const campaignRouter = require('./routes/campaign');
const facebookLeadRouter = require('./routes/facebook_lead');
const attendanceRouter = require('./routes/Attendance');
const MockTestPackageRouter = require('./routes/MockTestPackage');

// Import cron jobs
require('./helpers/croneJobs'); 

// Create Express app 
const app = express();
app.enable('trust proxy');

// Run self-healing database initialization on startup
const initializeDatabase = require('./helpers/db-init');
initializeDatabase();
const port = process.env.PORT || 3520;
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    upgrade: false,
    secure: true,
    rejectUnauthorized: false,
  }
});


const initializeTeacherChat = require('./helpers/socketTeacherChat'); // Import the socket module
initializeTeacherChat(io); // Pass the server to the socket module
app.use((req, res, next) => {
  req.io = io; // Attach the io instance to the request object
  next();
});
const initialChat = require('./helpers/chatbot/socketChatBot'); // Import the socket module
initialChat(io); // Pass the server to the socket module


// Set up view engine
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');
const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin', 'token', 'Student_Id', 'student_id'],
  credentials: true
};
app.use(cors(corsOptions));
app.options('*', cors(corsOptions));

// Middleware
app.use(logger('dev'));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Routes
const leadResponseRouter = require('./routes/lead_response');
app.use('/', indexRouter);
app.use('/Login', loginRouter);
app.use('/webhook', webhookRouter);
app.use('/lead-response', leadResponseRouter);


// Add this before your routes
// app.use(rateLimiter);  
app.use(jwt());
app.use('/course_category', categoryRouter);
app.use('/cart', cartRouter);  
app.use('/user', rateLimiter, userRouter);     // API-specific rate limiting
app.use('/student', studentRouter);
app.use('/course', courseRouter);
app.use('/teacher', teacherRouter); 
app.use('/Batch', BatchRouter); 
app.use('/Module', ModuleRouter);
app.use('/chat', chatRouter); 
app.use('/payment', paymentRouter); 
app.use('/exam', examRouter)
app.use('/Fees', FeesRouter)
app.use('/Expense', ExpenseRouter);
app.use('/Reports', ReportsRouter);
app.use('/Income', IncomeRouter);
app.use('/LateFee', LateFeeRouter);
app.use('/EmailTemplate', EmailTemplateRouter);
app.use('/Campaign', campaignRouter);
app.use('/facebooklead', facebookLeadRouter);
app.use('/Attendance', attendanceRouter);
app.use('/MockTestPackage', MockTestPackageRouter);





// 404 Error handler
app.use((req, res, next) => {
  next(createError(404));
});

// Error handler
app.use((err, req, res, next) => { 
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};
  res.status(err.status || 500);
  res.render('error');
});

app.use((err, req, res, next) => {
  if (err.name === 'UnauthorizedError') {
    res.status(401).json({ message: 'JWT token  is expired' });
  } else {
    next(err);
  }
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  // Optionally, you can perform cleanup operations here
  process.exit(1); // Uncomment this if you want to exit on uncaught exceptions
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Optionally, you can perform cleanup operations here
});

// Unhandled rejection handler
process.on('SyntaxError', (reason, promise) => {
  console.error('Unhandled Rejection  at:', promise, 'reason:', reason);
  // Optionally, you can perform cleanup operations here
});



// Start server
server.listen(port, '0.0.0.0', () => {
  console.log(`Server started on 0.0.0.0:${port} (accepting local and external network connections)`);
});

function generateToken() {
  return Math.random().toString(36).substr(2); // Example of a simple token generation, you might want to use more secure methods
}

async function checkDBConnection() {
  try {
      const query = util.promisify(db.query).bind(db);
      await query('SELECT 1');
      return true;
  } catch (error) {
      console.error('Database connection check failed:', error);
      return false;
  }
}
async function restartPM2() {
  return new Promise((resolve, reject) => {
      // Use full path to PM2 executable
      const pm2Path = path.join(process.env.PM2_HOME || '/usr/local/lib/node_modules/pm2/bin', 'pm2');
      exec(`pm2 restart 0`, (error, stdout, stderr) => {
          if (error) {
              console.error('PM2 restart error:', error);
              reject(error);
              return; 
          }
          console.log('PM2 restart output:', stdout);
          resolve(stdout);
      });
  });
}

// Add periodic connection check with proper error handling
setInterval(async () => {
  try {
      const isConnected = await checkDBConnection();
      if (!isConnected) {
          console.error('Database connection lost, initiating PM2 restart');
          try {
              await restartPM2();
              console.log('PM2 restart initiated successfully');
          } catch (restartError) {
              console.error('Failed to restart PM2:', restartError);
          }
      }
  } catch (error) {
      console.error('Connection check failed:', error);
  }
}, 30000);

// Rest of your app.js code...

// Graceful shutdown handler
async function gracefulShutdown() {
  console.log('Received shutdown signal');
  
  try {
      await new Promise((resolve, reject) => {
          db.end(err => {
              if (err) reject(err);
              else resolve();
          });
      });
      console.log('Database connections closed');
  } catch (error) {
      console.error('Error closing database connections:', error);
  }

  server.close(() => {
      console.log('Server closed');
      process.exit(0);
  });

  setTimeout(() => {
      console.error('Could not close connections in time, forcefully shutting down');
      process.exit(1);
  }, 10000);
}

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
module.exports = app;
import { createApplication } from "@specific-dev/framework";
import * as appSchema from './db/schema.js';
import * as authSchema from './db/auth-schema.js';
import { registerParentRoutes } from './routes/parent.js';
import { registerStaffRoutes } from './routes/staff.js';
import { registerTimeOffRoutes } from './routes/timeoff.js';
import { registerProfileRoutes } from './routes/profiles.js';
import { registerFormRoutes } from './routes/forms.js';
import { registerDailyReportRoutes } from './routes/dailyreports.js';
import { registerEnhancedDailyReportRoutes } from './routes/dailyreports-enhanced.js';
import { registerClassroomRoutes } from './routes/classrooms.js';

// Combine schemas
const schema = { ...appSchema, ...authSchema };

// Create application with schema for full database type support
export const app = await createApplication(schema);

// Export App type for use in route files
export type App = typeof app;

// Enable Better Auth
app.withAuth();

// Register routes - add your route modules here
// IMPORTANT: Always use registration functions to avoid circular dependency issues
registerParentRoutes(app);
registerStaffRoutes(app);
registerTimeOffRoutes(app);
registerProfileRoutes(app);
registerFormRoutes(app);
registerDailyReportRoutes(app);
registerEnhancedDailyReportRoutes(app);
registerClassroomRoutes(app);

await app.run();
app.logger.info('Application running');

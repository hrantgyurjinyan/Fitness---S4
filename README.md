```markdown
# Fitness Tracker App 🏋️‍♂️

A complete fitness application with personalized workout plans based on user profiles.

## Features ✨
- User authentication (Signup/Login/Logout)
- Age-specific workout plans (Teen/Adult/Senior)
- Goal-oriented training (Weight Loss/Muscle Gain/Maintenance)
- Profile management (Height/Weight/Age tracking)
- Responsive Bootstrap design

## Technologies 💻
**Frontend:**  
✔ EJS Templates  
✔ Bootstrap 5  
✔ Vanilla JS  

**Backend:**  
✔ Node.js  
✔ Express.js  
✔ MySQL  

**Security:**  
✔ Bcrypt password hashing  
✔ Session authentication  
✔ Input validation  

## Installation 🚀

1. Clone repo:
```bash
git clone https://github.com/yourusername/fitness-tracker.git
cd fitness-tracker
```

2. Install packages:
```bash
npm install
```

3. Create `.env` file:
```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=yourpassword
DB_NAME=fitness
SESSION_SECRET=yoursecretkey
PORT=3000
```

4. Database setup (run in MySQL):
```sql
CREATE DATABASE fitness;
USE fitness;

CREATE TABLE users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    email VARCHAR(100) UNIQUE NOT NULL,
    password VARCHAR(100) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE user_info (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    height INT,
    weight DECIMAL(5,2),
    age INT,
    goal ENUM('weight_loss', 'muscle_gain', 'maintenance'),
    FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE training_plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    goal VARCHAR(50) NOT NULL,
    age_group VARCHAR(50) NOT NULL,
    title VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    workouts JSON NOT NULL
);
```

5. Seed sample data (optional):
```bash
node seed.js
```

6. Start the server:
```bash
npm run dev
```

## Project Structure 📂
```
fitness-tracker/
├── config/
│   └── database.js
├── routes/
│   └── auth.js
├── views/
│   ├── dashboard.ejs
│   ├── login.ejs
│   ├── signup.ejs
│   └── ...
├── .env.example
├── app.js
└── package.json
```

## API Endpoints 🌐
| Route | Method | Description |
|-------|--------|-------------|
| / | GET | Home page redirect |
| /login | GET/POST | User login |
| /signup | GET/POST | User registration |
| /dashboard | GET | User dashboard |
| /user-info | GET/POST | Profile management |
| /training-plan | GET | Workout plan |
| /logout | GET | Session logout |

## Contributing 🤝
1. Fork the project
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request



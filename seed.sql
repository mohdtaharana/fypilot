-- Synapse Demo Data - Seed File

-- Coordinators
INSERT OR IGNORE INTO users (id, email, name, role, department) VALUES
  ('coord-1', 'admin@university.edu', 'Dr. Admin Coordinator', 'coordinator', 'Computer Science');

-- Supervisors
INSERT OR IGNORE INTO users (id, email, name, role, department, expertise, research_areas, max_students) VALUES
  ('sup-1', 'ahmed.khan@university.edu', 'Dr. Ahmed Khan', 'supervisor', 'Computer Science', '["Machine Learning", "Computer Vision", "Deep Learning", "AI", "Neural Networks"]', '["Object Detection", "Image Classification", "GANs"]', 8),
  ('sup-2', 'sara.ali@university.edu', 'Dr. Sara Ali', 'supervisor', 'Computer Science', '["Web Engineering", "Cloud Computing", "Recommendation Systems", "React", "Node.js"]', '["Scalable Systems", "Microservices", "User Experience"]', 6),
  ('sup-3', 'hassan.raza@university.edu', 'Dr. Hassan Raza', 'supervisor', 'Software Engineering', '["Cybersecurity", "Network Security", "Blockchain", "Cryptography"]', '["Intrusion Detection", "Smart Contracts", "Privacy"]', 7),
  ('sup-4', 'fatima.zahra@university.edu', 'Dr. Fatima Zahra', 'supervisor', 'Data Science', '["Natural Language Processing", "Data Mining", "Big Data", "Python", "Analytics"]', '["Sentiment Analysis", "Text Classification", "Knowledge Graphs"]', 5),
  ('sup-5', 'usman.malik@university.edu', 'Dr. Usman Malik', 'supervisor', 'Computer Science', '["IoT", "Embedded Systems", "Robotics", "Arduino", "Raspberry Pi"]', '["Smart Home", "Industrial IoT", "Sensor Networks"]', 6);

-- Students
INSERT OR IGNORE INTO users (id, email, name, role, department) VALUES
  ('stu-1', 'ali.hassan@student.edu', 'Ali Hassan', 'student', 'Computer Science'),
  ('stu-2', 'maria.khan@student.edu', 'Maria Khan', 'student', 'Computer Science'),
  ('stu-3', 'bilal.ahmed@student.edu', 'Bilal Ahmed', 'student', 'Software Engineering'),
  ('stu-4', 'ayesha.siddiqui@student.edu', 'Ayesha Siddiqui', 'student', 'Data Science'),
  ('stu-5', 'omar.farooq@student.edu', 'Omar Farooq', 'student', 'Computer Science'),
  ('stu-6', 'zainab.noor@student.edu', 'Zainab Noor', 'student', 'Software Engineering');

-- Proposals
INSERT OR IGNORE INTO proposals (id, title, abstract, problem_statement, objectives, methodology, expected_outcomes, technologies, scope, status, submitted_by) VALUES
  ('prop-1', 'Smart Traffic Monitoring System Using Computer Vision',
   'This project proposes a real-time traffic monitoring system that uses deep learning and computer vision to detect vehicles, analyze traffic patterns, and predict congestion. The system will process live camera feeds to provide actionable insights for traffic management authorities.',
   'Urban traffic congestion leads to significant economic losses and environmental pollution. Current monitoring systems rely on manual observation or simple sensor-based counting, which lack the ability to classify vehicles, detect incidents, or predict future congestion patterns.',
   'Develop a real-time vehicle detection model with 90%+ accuracy. Implement traffic flow analysis and congestion prediction. Create a dashboard for traffic management authorities. Deploy the system for real-time processing of camera feeds.',
   'We will use YOLOv8 for vehicle detection, trained on a custom dataset of local traffic images. A CNN-LSTM hybrid model will be used for congestion prediction based on historical patterns. The system will be built using Python, OpenCV, and deployed with Flask API backend and React frontend.',
   'A working prototype that can process live camera feeds, detect and classify vehicles in real-time, and provide congestion predictions with 85%+ accuracy.',
   'Python, TensorFlow, YOLOv8, OpenCV, React, Flask, PostgreSQL',
   'The system will cover single-intersection monitoring with up to 4 camera angles. Multi-intersection coordination is out of scope for this FYP.',
   'submitted', 'stu-1'),
  
  ('prop-2', 'AI-Powered Student Counseling Chatbot',
   'An intelligent chatbot system designed to provide academic counseling to university students. The system uses natural language processing to understand student queries about course selection, career guidance, and academic procedures, providing personalized recommendations.',
   'Students often face difficulties in academic planning due to limited access to counselors. Long wait times and scheduling conflicts prevent students from getting timely guidance, leading to poor course selections and academic underperformance.',
   'Build an NLP-based chatbot capable of understanding academic queries. Integrate with university course catalog and prerequisite data. Provide personalized course recommendations based on student history. Achieve 80%+ user satisfaction rate.',
   'The chatbot will use transformer-based models fine-tuned on academic counseling conversations. RAG (Retrieval Augmented Generation) will be used to ground responses in actual university data. User testing with 50+ students will validate effectiveness.',
   'A functional chatbot deployed on the university portal that can handle common academic queries with high accuracy and provide relevant course recommendations.',
   'Python, LangChain, OpenAI API, React, MongoDB, Docker',
   'Limited to undergraduate course counseling within the CS department. Career counseling will be basic (FAQ-based). Does not replace human counselors for complex cases.',
   'submitted', 'stu-2'),

  ('prop-3', 'Blockchain-Based Academic Certificate Verification System',
   'A decentralized system for issuing and verifying academic certificates using blockchain technology. This eliminates certificate fraud and provides instant verification for employers and institutions.',
   'Certificate fraud is a growing problem globally. Traditional verification processes are slow, requiring manual contact with issuing institutions. This creates delays in hiring and admissions processes.',
   'Design a blockchain architecture for certificate storage. Implement smart contracts for certificate issuance. Build a verification portal for third parties. Ensure compliance with data privacy regulations.',
   'Ethereum blockchain with Solidity smart contracts will store certificate hashes. IPFS will store certificate metadata. A React web application will provide the user interface for issuance and verification. Testing will use Sepolia testnet.',
   'A working prototype demonstrating the full lifecycle: certificate issuance by university, storage on blockchain, and instant verification by third parties.',
   'Solidity, Ethereum, IPFS, React, Node.js, Web3.js, MetaMask',
   'Prototype will cover degree certificates only. Transcript verification is future work. Testing limited to testnet deployment.',
   'approved', 'stu-3'),

  ('prop-4', 'Sentiment Analysis of Urdu Social Media Content',
   'This project develops a sentiment analysis system specifically designed for Urdu language content on social media platforms. It addresses the unique challenges of Urdu NLP including script complexity and code-mixing with English.',
   'While sentiment analysis tools for English are mature, Urdu—spoken by over 200 million people—lacks robust NLP tools. Businesses and organizations cannot effectively analyze Urdu social media for brand monitoring or public opinion.',
   'Create a labeled Urdu sentiment dataset of 10,000+ samples. Develop a multilingual sentiment model handling Urdu-English code-mixing. Achieve F1 score of 75%+ on the test set. Build an API for real-time sentiment classification.',
   'We will collect data from Twitter and Facebook using their APIs. Manual annotation with inter-annotator agreement validation. BERT multilingual model will be fine-tuned. Comparison with rule-based and traditional ML baselines.',
   'A sentiment analysis API capable of classifying Urdu text into positive, negative, and neutral categories with competitive accuracy.',
   'Python, Hugging Face Transformers, BERT, FastAPI, PostgreSQL, Docker',
   'Focus on text-only content (no image/video analysis). Limited to Twitter and Facebook data. Three-class sentiment only (no fine-grained emotions).',
   'under_review', 'stu-4'),

  ('prop-5', 'IoT-Based Smart Greenhouse Monitoring System',
   'An automated greenhouse monitoring and control system using IoT sensors to optimize plant growth conditions. The system monitors temperature, humidity, soil moisture, and light, automatically adjusting environment parameters.',
   'Traditional greenhouse farming relies on manual monitoring and adjustment of environmental conditions, leading to suboptimal growing conditions, water waste, and lower crop yields.',
   'Deploy IoT sensor network for real-time environmental monitoring. Implement automated control for irrigation, ventilation, and lighting. Create a mobile dashboard for remote monitoring. Achieve 20% improvement in water efficiency.',
   'Arduino and ESP32 microcontrollers with DHT22, soil moisture, and light sensors. MQTT protocol for communication. Node-RED for automation rules. React Native mobile app for monitoring. Cloud storage on Firebase.',
   'A working prototype greenhouse with automated environmental control, real-time monitoring dashboard, and demonstrated improvement in resource efficiency.',
   'Arduino, ESP32, MQTT, Node-RED, React Native, Firebase, Python',
   'Single greenhouse prototype (3m x 3m). Limited to four environmental parameters. No integration with commercial agricultural systems.',
   'submitted', 'stu-5'),

  ('prop-6', 'Real-Time Object Detection for Autonomous Vehicles',
   'This project develops an optimized object detection system for autonomous vehicle applications, focusing on real-time performance on edge devices while maintaining high accuracy for safety-critical detection.',
   'Autonomous vehicles require extremely fast and accurate object detection. Current models are either too slow for real-time edge deployment or sacrifice accuracy for speed, creating safety concerns.',
   'Optimize YOLOv8 for edge deployment using model pruning and quantization. Achieve real-time inference (30+ FPS) on NVIDIA Jetson. Maintain mAP of 80%+ on KITTI dataset. Implement multi-class detection for vehicles, pedestrians, and traffic signs.',
   'Transfer learning from pre-trained YOLOv8 models. Progressive pruning with accuracy monitoring. INT8 quantization using TensorRT. Testing on KITTI and custom captured datasets.',
   'An optimized detection model running at 30+ FPS on Jetson Nano with competitive accuracy on standard autonomous driving benchmarks.',
   'Python, PyTorch, YOLOv8, TensorRT, NVIDIA Jetson, CUDA, OpenCV',
   'Focus on object detection only (not path planning or vehicle control). Testing in simulation and on recorded datasets, not on actual vehicles.',
   'submitted', 'stu-6');

-- Projects (from approved proposals)
INSERT OR IGNORE INTO projects (id, title, description, proposal_id, status, health, progress, supervisor_id, department, start_date, end_date) VALUES
  ('proj-1', 'Blockchain-Based Academic Certificate Verification System',
   'A decentralized system for issuing and verifying academic certificates using blockchain technology.',
   'prop-3', 'active', 'at_risk', 45, 'sup-3', 'Software Engineering', '2026-02-01', '2026-08-30'),
  ('proj-2', 'Smart Campus Navigation App',
   'A mobile application providing indoor navigation for university campus using BLE beacons and AR technology.',
   NULL, 'active', 'healthy', 72, 'sup-2', 'Computer Science', '2026-01-15', '2026-07-30'),
  ('proj-3', 'Automated Code Review Tool',
   'An AI-powered tool that reviews code submissions and provides feedback on code quality, security vulnerabilities, and best practices.',
   NULL, 'active', 'critical', 28, 'sup-1', 'Computer Science', '2026-03-01', '2026-09-15');

-- Project Members
INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES
  ('pm-1', 'proj-1', 'stu-3', 'lead'),
  ('pm-2', 'proj-1', 'stu-6', 'member'),
  ('pm-3', 'proj-2', 'stu-2', 'lead'),
  ('pm-4', 'proj-2', 'stu-5', 'member'),
  ('pm-5', 'proj-3', 'stu-1', 'lead'),
  ('pm-6', 'proj-3', 'stu-4', 'member');

-- Milestones for proj-1 (Blockchain Certificate)
INSERT OR IGNORE INTO milestones (id, project_id, title, description, due_date, status, completed_at) VALUES
  ('ms-1', 'proj-1', 'Requirements & Design', 'Complete requirements analysis and system design', '2026-03-01', 'completed', '2026-02-28'),
  ('ms-2', 'proj-1', 'Smart Contract Development', 'Develop and test Solidity smart contracts', '2026-04-15', 'completed', '2026-04-20'),
  ('ms-3', 'proj-1', 'Frontend Development', 'Build React verification portal', '2026-05-30', 'in_progress', NULL),
  ('ms-4', 'proj-1', 'Integration & Testing', 'Integrate all components and perform testing', '2026-07-15', 'pending', NULL),
  ('ms-5', 'proj-1', 'Deployment & Documentation', 'Deploy to testnet and complete documentation', '2026-08-15', 'pending', NULL);

-- Milestones for proj-2 (Campus Navigation)
INSERT OR IGNORE INTO milestones (id, project_id, title, description, due_date, status, completed_at) VALUES
  ('ms-6', 'proj-2', 'Research & Prototyping', 'Research BLE beacon tech and create prototype', '2026-02-15', 'completed', '2026-02-12'),
  ('ms-7', 'proj-2', 'Core Navigation Engine', 'Implement indoor positioning algorithm', '2026-03-30', 'completed', '2026-03-28'),
  ('ms-8', 'proj-2', 'AR Integration', 'Integrate AR overlay for navigation', '2026-05-15', 'completed', '2026-05-10'),
  ('ms-9', 'proj-2', 'User Testing', 'Conduct user testing with 30+ students', '2026-06-30', 'in_progress', NULL),
  ('ms-10', 'proj-2', 'Final Report', 'Complete thesis and final presentation', '2026-07-25', 'pending', NULL);

-- Milestones for proj-3 (Code Review Tool)
INSERT OR IGNORE INTO milestones (id, project_id, title, description, due_date, status, completed_at) VALUES
  ('ms-11', 'proj-3', 'Literature Review', 'Review existing code analysis tools', '2026-04-01', 'completed', '2026-04-05'),
  ('ms-12', 'proj-3', 'Parser Development', 'Build code parsing and AST analysis', '2026-05-15', 'overdue', NULL),
  ('ms-13', 'proj-3', 'AI Model Training', 'Train model on code quality datasets', '2026-06-30', 'pending', NULL),
  ('ms-14', 'proj-3', 'Integration', 'Build VS Code extension and web interface', '2026-08-01', 'pending', NULL),
  ('ms-15', 'proj-3', 'Testing & Deployment', 'Test with real student submissions', '2026-09-01', 'pending', NULL);

-- Tasks for proj-1
INSERT OR IGNORE INTO tasks (id, project_id, milestone_id, title, assigned_to, status, priority, due_date, completed_at) VALUES
  ('task-1', 'proj-1', 'ms-3', 'Design verification portal UI', 'stu-3', 'completed', 'high', '2026-05-10', '2026-05-09'),
  ('task-2', 'proj-1', 'ms-3', 'Implement certificate upload flow', 'stu-3', 'in_progress', 'high', '2026-05-20', NULL),
  ('task-3', 'proj-1', 'ms-3', 'Build verification search interface', 'stu-6', 'overdue', 'high', '2026-05-25', NULL),
  ('task-4', 'proj-1', 'ms-3', 'Connect frontend to smart contracts', 'stu-6', 'todo', 'medium', '2026-06-05', NULL),
  ('task-5', 'proj-1', 'ms-4', 'Write integration tests', 'stu-3', 'todo', 'medium', '2026-07-01', NULL),
  ('task-6', 'proj-1', 'ms-4', 'Security audit of smart contracts', 'stu-6', 'todo', 'high', '2026-07-10', NULL);

-- Tasks for proj-2
INSERT OR IGNORE INTO tasks (id, project_id, milestone_id, title, assigned_to, status, priority, due_date, completed_at) VALUES
  ('task-7', 'proj-2', 'ms-9', 'Recruit test participants', 'stu-2', 'completed', 'medium', '2026-06-15', '2026-06-12'),
  ('task-8', 'proj-2', 'ms-9', 'Prepare test scenarios', 'stu-5', 'completed', 'medium', '2026-06-20', '2026-06-18'),
  ('task-9', 'proj-2', 'ms-9', 'Conduct usability testing sessions', 'stu-2', 'in_progress', 'high', '2026-07-05', NULL),
  ('task-10', 'proj-2', 'ms-9', 'Analyze test results', 'stu-5', 'todo', 'medium', '2026-07-15', NULL),
  ('task-11', 'proj-2', 'ms-10', 'Write thesis Chapter 1-3', 'stu-2', 'in_progress', 'high', '2026-07-10', NULL),
  ('task-12', 'proj-2', 'ms-10', 'Prepare presentation slides', 'stu-5', 'todo', 'low', '2026-07-20', NULL);

-- Tasks for proj-3 (many overdue to show risk)
INSERT OR IGNORE INTO tasks (id, project_id, milestone_id, title, assigned_to, status, priority, due_date, completed_at) VALUES
  ('task-13', 'proj-3', 'ms-12', 'Implement JavaScript parser', 'stu-1', 'overdue', 'high', '2026-05-01', NULL),
  ('task-14', 'proj-3', 'ms-12', 'Implement Python parser', 'stu-4', 'overdue', 'high', '2026-05-08', NULL),
  ('task-15', 'proj-3', 'ms-12', 'Build AST analysis module', 'stu-1', 'overdue', 'high', '2026-05-15', NULL),
  ('task-16', 'proj-3', 'ms-12', 'Code smell detection rules', 'stu-4', 'todo', 'medium', '2026-05-20', NULL),
  ('task-17', 'proj-3', 'ms-13', 'Collect training dataset', 'stu-1', 'todo', 'medium', '2026-06-01', NULL),
  ('task-18', 'proj-3', 'ms-13', 'Train initial model', 'stu-4', 'todo', 'high', '2026-06-15', NULL);

-- Meetings
INSERT OR IGNORE INTO meetings (id, project_id, title, scheduled_at, completed_at, status, notes) VALUES
  ('meet-1', 'proj-1', 'Week 8 Progress Review', '2026-04-15', '2026-04-15', 'completed', 'Discussed smart contract progress. On track.'),
  ('meet-2', 'proj-1', 'Week 12 Sprint Review', '2026-05-13', '2026-05-13', 'completed', 'Frontend behind schedule. Need to catch up.'),
  ('meet-3', 'proj-1', 'Week 16 Check-in', '2026-06-10', NULL, 'missed', NULL),
  ('meet-4', 'proj-2', 'Week 10 Demo', '2026-04-28', '2026-04-28', 'completed', 'Navigation demo impressive. AR needs polish.'),
  ('meet-5', 'proj-2', 'Week 14 Review', '2026-05-26', '2026-05-26', 'completed', 'User testing plan approved.'),
  ('meet-6', 'proj-2', 'Week 18 Update', '2026-06-23', '2026-06-23', 'completed', 'Testing going well. Good progress.'),
  ('meet-7', 'proj-3', 'Week 6 Kickoff', '2026-04-14', '2026-04-14', 'completed', 'Literature review discussed. Timeline set.'),
  ('meet-8', 'proj-3', 'Week 10 Check-in', '2026-05-12', NULL, 'missed', NULL),
  ('meet-9', 'proj-3', 'Week 14 Catch-up', '2026-06-09', NULL, 'missed', NULL);

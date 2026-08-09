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
   'prop-3', 'active', 'at_risk', 45, 'sup-3', 'Software Engineering', '2026-02-01', '2026-08-30');

-- Project Members
INSERT OR IGNORE INTO project_members (id, project_id, user_id, role) VALUES
  ('pm-1', 'proj-1', 'stu-3', 'lead'),
  ('pm-2', 'proj-1', 'stu-6', 'member'),
  ('pm-7', 'proj-1', 'stu-1', 'member');

-- Meetings
INSERT OR IGNORE INTO meetings (id, project_id, title, scheduled_at, completed_at, status, notes) VALUES
  ('meet-1', 'proj-1', 'Week 8 Progress Review', '2026-04-15', '2026-04-15', 'completed', 'Discussed smart contract progress. On track.'),
  ('meet-2', 'proj-1', 'Week 12 Sprint Review', '2026-05-13', '2026-05-13', 'completed', 'Frontend behind schedule. Need to catch up.'),
  ('meet-3', 'proj-1', 'Week 16 Check-in', '2026-06-10', NULL, 'missed', NULL);

-- Student Groups
INSERT OR IGNORE INTO groups (id, name, leader_id, status, max_members) VALUES
  ('grp-1', 'GreenIQ — Smart Agriculture Squad', 'stu-4', 'pending', 4),
  ('grp-2', 'VisionSync — Traffic Vision Team', 'stu-2', 'approved', 4);

INSERT OR IGNORE INTO group_members (id, group_id, user_id) VALUES
  ('gm-1', 'grp-1', 'stu-4'),
  ('gm-2', 'grp-1', 'stu-5'),
  ('gm-3', 'grp-2', 'stu-2'),
  ('gm-4', 'grp-2', 'stu-1'),
  ('gm-5', 'grp-2', 'stu-6');


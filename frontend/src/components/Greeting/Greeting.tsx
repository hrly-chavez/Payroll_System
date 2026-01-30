import React from 'react';
import styles from './Greeting.module.css';

const Greeting: React.FC = () => {
  const name = localStorage.getItem('user_name') || 'User';

  return (
    <div className={styles.card}>
      <div className={styles.greeting}>
        Good to see you, <span className={styles.name}>{name}</span> <span role="img" aria-label="waving">👋</span>
      </div>
    </div>
  );
};

export default Greeting;

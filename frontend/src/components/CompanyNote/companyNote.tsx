import React from "react";
import styles from "./companyNote.module.css";

type CompanyNoteProps = {
  title?: string;
  content: string;
  author?: string;
};

const CompanyNote: React.FC<CompanyNoteProps> = ({
  title = "Company Note",
  content,
  author,
}) => {
  return (
    <div className={styles.noteCard}>
      <h3 className={styles.title}>{title}</h3>

      <p className={styles.content}>
        {content}
      </p>

      {author && (
        <div className={styles.author}>
          — {author}
        </div>
      )}
    </div>
  );
};

export default CompanyNote;

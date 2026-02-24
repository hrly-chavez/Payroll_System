
import { Card, Button, Modal, Input, message } from "antd";
import { useEffect, useState } from "react";
import api from "../../api/axios";
import styles from "./CompanyNote.module.css";

const { TextArea } = Input;

interface Props {
  role?: string;
}

interface CompanyNoteType {
  id: number;
  note: string;
  created_at: string;
  created_by: string;
}

export default function CompanyNote({ role }: Props) {
  const [latestNote, setLatestNote] = useState<CompanyNoteType | null>(null);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");

  const fetchLatestNote = async () => {
  try {
    const res = await api.get("employees/company-notes/latest/");
    console.log("Latest note from backend:", res.data); 
    setLatestNote(res.data); 
  } catch {
    message.error("Failed to load notes");
  }
};

  const handleSubmit = async () => {
  try {
    await api.post("employees/company-notes/", {
      note: content,
    });

    message.success("Note added");
    setOpen(false);
    setContent("");

    fetchLatestNote(); // instantly refresh
  } catch {
    message.error("Failed to add note");
  }
};


  useEffect(() => {
  fetchLatestNote();

  const interval = setInterval(() => {
    fetchLatestNote();
  }, 10000);

  return () => clearInterval(interval);
}, []);

   return (
    <>
      <Card
        title="Announcements"
        extra={
          role === "ADMIN" || role === "SUPER_ADMIN" ? (
            <Button
              size="small"
              className={styles.addButton}
              onClick={() => setOpen(true)}
            >
              +
            </Button>
          ) : null
        }
        className={styles.noteCard}
      >
        {latestNote ? (
        <>
          <div className={styles.content}>{latestNote.note}</div>
          <div className={styles.author}>
            — {latestNote.created_by}
          </div>
        </>
      ) : (
        <div>No company notes yet.</div>
      )}

      </Card>

      <Modal
        title="Add Company Note"
        open={open}
        onCancel={() => setOpen(false)}
        onOk={handleSubmit}
        centered
      >
        <TextArea
          rows={4}
          value={content}
          onChange={(e) => setContent(e.target.value)}
        />
      </Modal>
    </>
  );
}
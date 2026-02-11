import { Card, Button, Modal, Input, message } from "antd";
import { useEffect, useState } from "react";
import api from "../../api/axios";
import styles from "./CompanyNote.module.css";

const { TextArea } = Input;

interface Props {
  role?: string;
}

export default function CompanyNote({ role }: Props) {
  const [notes, setNotes] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [content, setContent] = useState("");

  const fetchNotes = async () => {
    try {
      const res = await api.get("/company-notes/");
      setNotes(res.data);
    } catch {
      message.error("Failed to load notes");
    }
  };

  const handleSubmit = async () => {
    try {
      await api.post("/company-notes/", { content });
      message.success("Note added");
      setOpen(false);
      setContent("");
      fetchNotes();
    } catch {
      message.error("Failed to add note");
    }
  };

  useEffect(() => {
    fetchNotes();
  }, []);

  const latestNote = notes[0];

  return (
    <>
      <Card
        title="Company Note"
        extra={
          role === "ADMIN" || role === "SUPERADMIN" ? (
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
            <div className={styles.content}>{latestNote.content}</div>
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

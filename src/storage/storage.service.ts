export enum Status {
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  SUBMISSION_REQUIRED = 'SUBMISSION_REQUIRED',
}

export enum ClientType {
  Iden3MobileServiceV1 = 'Iden3MobileServiceV1',
  Iden3WebRedirectV1 = 'Iden3WebRedirectV1',
}

export interface Session {
  id: string;
  did: string;
  credentialId: string;
  externalSessionId: string;
  thid: string;
  status: Status;
  clientType: ClientType;
}

export class StorageService {
  private sessions: Map<string, Session>;

  constructor() {
    this.sessions = new Map<string, Session>();
  }

  createSession(session: Session): void {
    this.sessions.set(session.id, session);
  }

  getSession(id: string): Session | undefined {
    return this.sessions.get(id);
  }

  updateSession(id: string, updatedSession: Session): void {
    if (this.sessions.has(id)) {
      this.sessions.set(id, updatedSession);
    }
  }

  deleteSession(id: string): void {
    this.sessions.delete(id);
  }

  findByExternalSessionId(externalSessionId: string): Session | undefined {
    for (const session of this.sessions.values()) {
      if (session.externalSessionId === externalSessionId) {
        return session;
      }
    }
  }
}

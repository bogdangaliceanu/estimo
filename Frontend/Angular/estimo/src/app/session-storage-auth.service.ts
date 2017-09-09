import { Injectable } from '@angular/core';

import { AuthService } from './auth.service';

@Injectable()
export class SessionStorageAuthService implements AuthService {
    get authToken() {
        return sessionStorage.getItem('authToken');
    }

    set authToken(value: string) {
        if (!value) {
            sessionStorage.removeItem('authToken');
        }
        else {
            sessionStorage.setItem('authToken', value);
        }
    }
}
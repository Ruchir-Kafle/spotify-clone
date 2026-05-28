import AsyncStorage from '@react-native-async-storage/async-storage';
import type { MobileSession } from '../types/api';

const SESSION_KEY = 'music-server.mobile-session';

export async function loadStoredSession() {
	const rawSession = await AsyncStorage.getItem(SESSION_KEY);

	if (!rawSession) {
		return undefined;
	}

	try {
		return JSON.parse(rawSession) as MobileSession;
	} catch {
		await AsyncStorage.removeItem(SESSION_KEY);
		return undefined;
	}
}

export async function saveStoredSession(session: MobileSession) {
	await AsyncStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function clearStoredSession() {
	await AsyncStorage.removeItem(SESSION_KEY);
}

async function apiCall(path, { method = 'GET', body } = {}) {
    const options = { method, headers: {} };
    if (body !== undefined) {
        options.headers['Content-Type'] = 'application/json';
        options.body = JSON.stringify(body);
    }

    let response;
    try {
        response = await fetch(path, options);
    } catch {
        throw new Error('Network error. Please check your connection and try again.');
    }

    let json;
    try {
        json = await response.json();
    } catch {
        throw new Error('Unexpected server response.');
    }

    if (!response.ok || !json || json.success !== true) {
        const message = json && json.error && json.error.message ? json.error.message : 'Request failed.';
        const err = new Error(message);
        if (json && json.error && json.error.code) {
            err.code = json.error.code;
        }
        throw err;
    }

    return json.data;
}

export async function createTrip({ name, currency } = {}) {
    return apiCall('api/trip_create.php', { method: 'POST', body: { name, currency } });
}

export async function getTrip(slug) {
    return apiCall(`api/trip_get.php?slug=${encodeURIComponent(slug)}`);
}

export async function updateTrip(slug, { name, currency }) {
    return apiCall('api/trip_update.php', { method: 'POST', body: { slug, name, currency } });
}

export async function addMember(slug, name) {
    return apiCall('api/member_add.php', { method: 'POST', body: { slug, name } });
}

export async function removeMember(slug, memberId) {
    return apiCall('api/member_remove.php', { method: 'POST', body: { slug, member_id: memberId } });
}

export async function addExpense(slug, { description, amount, paidByMemberId, participantIds }) {
    return apiCall('api/expense_add.php', {
        method: 'POST',
        body: {
            slug,
            description,
            amount,
            paid_by_member_id: paidByMemberId,
            participant_member_ids: participantIds,
        },
    });
}

export async function deleteExpense(slug, expenseId) {
    return apiCall('api/expense_delete.php', { method: 'POST', body: { slug, expense_id: expenseId } });
}

export async function resetTrip(slug) {
    return apiCall('api/trip_reset.php', { method: 'POST', body: { slug } });
}

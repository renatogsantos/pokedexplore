const webStore = {
  saveData(key, data) {
    try {
      const serializedData = JSON.stringify(data);
      localStorage.setItem(key, serializedData);
      return true;
    } catch (error) {
      console.error("Erro ao salvar dados no localStorage:", error);
      return false;
    }
  },

  getData(key) {
    try {
      const serializedData = localStorage.getItem(key);
      if (serializedData === null) {
        return null;
      }
      return JSON.parse(serializedData);
    } catch (error) {
      console.error("Erro ao recuperar dados do localStorage:", error);
      return null;
    }
  },

  deleteData(key) {
    try {
      localStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error("Erro ao deletar dados do localStorage:", error);
      return false;
    }
  },

  deleteAllData() {
    try {
      localStorage.clear();
      return true;
    } catch (error) {
      console.error("Erro ao deletar todos os dados do localStorage:", error);
      return false;
    }
  },
};

export default webStore;

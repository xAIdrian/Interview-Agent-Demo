import mariadb

try:
    # 1) Connect to the server (adjust credentials/host as needed)
    conn = mariadb.connect(
        user="root",
        password="W2Mhouse/*",
        host="localhost",
        port=3306
    )
    cursor = conn.cursor()

    # 2) Create the database "gulpin"
    cursor.execute("CREATE DATABASE IF NOT EXISTS gulpin")

    # 3) Switch to the "gulpin" database
    cursor.execute("USE gulpin")

    # 4) Create a table named "pokemon"
    # Example schema: id, name, type
    create_table_query = """
        CREATE TABLE IF NOT EXISTS pokemon (
            id INT AUTO_INCREMENT PRIMARY KEY,
            name VARCHAR(50) NOT NULL,
            type VARCHAR(50)
        )
    """
    cursor.execute(create_table_query)

    print("Database 'gulpin' and table 'pokemon' created successfully.")

except mariadb.Error as e:
    print(f"Error: {e}")

finally:
    # Close cursor and connection
    if cursor:
        cursor.close()
    if conn:
        conn.close()
